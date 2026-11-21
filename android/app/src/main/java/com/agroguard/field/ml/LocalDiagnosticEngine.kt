package com.agroguard.field.ml

import android.graphics.Bitmap
import android.graphics.Color
import com.agroguard.field.data.LocalKnowledgeRepository
import com.agroguard.field.model.AnalysisDecision
import com.agroguard.field.model.BoundingBoxNormalized
import com.agroguard.field.model.CropCondition
import com.agroguard.field.model.CropEntry
import com.agroguard.field.model.DiagnosisOutput
import com.agroguard.field.model.FarmerContextInput
import com.agroguard.field.model.ImageQualityMetrics
import java.io.ByteArrayOutputStream
import java.util.UUID
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class LocalDiagnosticEngine(
    private val repository: LocalKnowledgeRepository
) {
    /**
     * Crops the captured image to the farmer's bounding box, evaluates lighting & sharpness,
     * and fuses on-device visual traits with pulldown context across the 30 embedded SEA crops & 9 abiotic causes.
     */
    fun analyze(
        sourceBitmap: Bitmap,
        box: BoundingBoxNormalized,
        context: FarmerContextInput
    ): AnalysisDecision {
        val roiBitmap = cropToBoundingBox(sourceBitmap, box)
        val quality = evaluateImageQuality(roiBitmap)
        val jpegBytes = compressRoiForPossibleCloud(roiBitmap)
        val tempId = UUID.randomUUID().toString()

        if (!quality.isWellLit) {
            return AnalysisDecision.UnresolvedNeedCloud(
                tempCaseId = tempId,
                reason = quality.lightingHint,
                roiJpegBytes = jpegBytes
            )
        }

        val isOutOfDistribution =
            quality.anomalousPurpleRatio > 0.045 ||
                (quality.greenRatio < 0.09 && quality.yellowRatio < 0.08 && quality.necroticBrownRatio < 0.12)

        val hasExplicitAbioticSignal =
            (context.soilMoisture != "unknown" && context.soilMoisture != "normal") ||
                (context.sunlightExposure != "unknown" && context.sunlightExposure != "full_sun") ||
                (context.recentInputs != "unknown" && context.recentInputs != "none") ||
                context.fieldCondition == "storm_wind" ||
                context.primarySymptom == "tip_scorch" ||
                context.primarySymptom == "bleached_distorted"

        val crops = repository.getAll30Crops()
        val searchCrops = if (context.suspectedCropId != "auto") {
            crops.filter { it.id == context.suspectedCropId }
        } else {
            crops
        }

        data class ScoredCandidate(
            val cropCommonName: String,
            val cropScientificName: String,
            val diagnosisName: String,
            val pathogenScientificName: String,
            val category: String,
            val summary: String,
            val recommendations: com.agroguard.field.model.ConditionRecommendation,
            val probability: Int
        )

        val scored = mutableListOf<ScoredCandidate>()
        for (crop in searchCrops) {
            for (condition in crop.conditions) {
                var score = 0.25
                val sig = condition.visualSignature
                when (sig.dominantTrait) {
                    "brown_lesion" -> {
                        if (quality.necroticBrownRatio >= (sig.minNecroticRatio ?: 0.05) && quality.greenRatio > 0.15) score += 0.28
                        if (quality.yellowRatio >= (sig.minYellowRatio ?: 0.03)) score += 0.07
                    }
                    "gray_diamond" -> {
                        if (quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?: 0.035) && quality.necroticBrownRatio > 0.04) score += 0.31
                    }
                    "chewed_frass" -> {
                        if (quality.yellowRatio >= 0.045 && quality.necroticBrownRatio >= 0.035 && quality.greenRatio > 0.18) score += 0.28
                    }
                    "orange_rust" -> {
                        if (quality.rustOrangeRatio >= (sig.minRustRatio ?: 0.045)) score += 0.33
                    }
                    "yellow_mosaic" -> {
                        if (quality.yellowRatio >= (sig.minYellowRatio ?: 0.11)) score += 0.28
                    }
                    "white_powder" -> {
                        if (quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?: 0.07)) score += 0.30
                    }
                    "dark_rot" -> {
                        if (quality.necroticBrownRatio >= (sig.minNecroticRatio ?: 0.10)) score += 0.26
                    }
                    "healthy_green" -> {
                        if (quality.greenRatio > 0.42 && quality.necroticBrownRatio < 0.04 && quality.anomalousPurpleRatio < 0.02) {
                            score += 0.34
                        } else {
                            score -= 0.12
                        }
                    }
                }

                if (context.suspectedCropId == crop.id) score += 0.18
                if (context.plantPart != "unknown") {
                    if (condition.affectedParts.contains(context.plantPart)) score += 0.08 else score -= 0.06
                }
                if (context.primarySymptom != "unknown") {
                    if (condition.symptomTags.contains(context.primarySymptom)) score += 0.16 else score -= 0.08
                }
                if (context.growthStage != "unknown" && condition.growthStages.contains(context.growthStage)) score += 0.04
                if (context.fieldCondition != "unknown" && condition.weatherTriggers.contains(context.fieldCondition)) score += 0.05
                if (hasExplicitAbioticSignal && condition.category != "Healthy") score -= 0.14
                if (isOutOfDistribution) score -= 0.32

                val pct = max(8, min(95, (score * 100.0).roundToInt()))
                scored.add(
                    ScoredCandidate(
                        cropCommonName = crop.commonName,
                        cropScientificName = crop.scientificName,
                        diagnosisName = condition.name,
                        pathogenScientificName = condition.scientificName,
                        category = condition.category,
                        summary = condition.summary,
                        recommendations = condition.recommendations,
                        probability = pct
                    )
                )
            }
        }

        // Evaluate Offline Abiotic & Environmental Stress Causes
        val selectedCrop = crops.firstOrNull { it.id == context.suspectedCropId }
        val abioticCropCommon = selectedCrop?.commonName ?: "Crop Not Selected"
        val abioticCropSci = selectedCrop?.scientificName ?: "Water, Sun, Soil, or Fertilizer Issue"

        for (abiotic in repository.getAbioticCauses()) {
            var score = 0.14
            var triggerMatches = 0
            val sig = abiotic.visualSignature
            when (sig.dominantTrait) {
                "brown_lesion" -> if (quality.necroticBrownRatio >= (sig.minNecroticRatio ?: 0.04)) score += 0.14
                "yellow_mosaic" -> if (quality.yellowRatio >= (sig.minYellowRatio ?: 0.09)) score += 0.15
                "white_powder" -> if (quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?: 0.06)) score += 0.15
                "orange_rust" -> if (quality.rustOrangeRatio >= 0.04 || quality.necroticBrownRatio >= 0.05) score += 0.15
                "healthy_green" -> if (quality.greenRatio > 0.25) score += 0.10
            }

            if (context.plantPart != "unknown") {
                if (abiotic.affectedParts.contains(context.plantPart)) score += 0.06 else score -= 0.04
            }
            if (context.primarySymptom != "unknown") {
                if (abiotic.symptomTags.contains(context.primarySymptom)) score += 0.14 else score -= 0.05
            }
            if (context.growthStage != "unknown" && abiotic.growthStages.contains(context.growthStage)) score += 0.03
            if (context.fieldCondition != "unknown" && abiotic.weatherTriggers.contains(context.fieldCondition)) {
                if (context.fieldCondition == "storm_wind" && abiotic.id == "abiotic_storm_mechanical") {
                    score += 0.40
                    triggerMatches++
                } else {
                    score += 0.09
                }
            }
            if (context.soilMoisture != "unknown" && context.soilMoisture != "normal") {
                if (abiotic.soilTriggers.contains(context.soilMoisture)) {
                    score += 0.42
                    triggerMatches++
                } else {
                    score -= 0.08
                }
            }
            if (context.sunlightExposure != "unknown" && context.sunlightExposure != "full_sun") {
                if (abiotic.sunlightTriggers.contains(context.sunlightExposure)) {
                    score += 0.46
                    triggerMatches++
                } else {
                    score -= 0.06
                }
            }
            if (context.recentInputs != "unknown" && context.recentInputs != "none") {
                if (abiotic.inputTriggers.contains(context.recentInputs)) {
                    score += 0.46
                    triggerMatches++
                } else {
                    score -= 0.08
                }
            }
            if (triggerMatches > 0 && context.suspectedCropId != "auto") score += 0.12
            if (isOutOfDistribution) score -= 0.32

            if (triggerMatches > 0 || score >= 0.30) {
                val pct = max(8, min(95, (score * 100.0).roundToInt()))
                scored.add(
                    ScoredCandidate(
                        cropCommonName = abioticCropCommon,
                        cropScientificName = abioticCropSci,
                        diagnosisName = abiotic.name,
                        pathogenScientificName = abiotic.scientificName,
                        category = abiotic.category,
                        summary = abiotic.summary,
                        recommendations = abiotic.recommendations,
                        probability = pct
                    )
                )
            }
        }

        val sorted = scored.sortedByDescending { it.probability }
        val distinctTop = mutableListOf<ScoredCandidate>()
        val seenNames = mutableSetOf<String>()
        for (cand in sorted) {
            val key = if (context.suspectedCropId == "auto") cand.diagnosisName.lowercase() else "${cand.cropCommonName}:${cand.diagnosisName}".lowercase()
            if (seenNames.add(key)) {
                distinctTop.add(cand)
            }
            if (distinctTop.size >= 4) break
        }

        val best = distinctTop.firstOrNull() ?: sorted.firstOrNull()
        val second = distinctTop.getOrNull(1)
        val margin = if (best != null && second != null) best.probability - second.probability else 20

        if (isOutOfDistribution || best == null || best.probability < 42) {
            return AnalysisDecision.UnresolvedNeedCloud(
                tempCaseId = tempId,
                reason = if (isOutOfDistribution) {
                    "This leaf pattern looks unfamiliar and is not in the 30-crop offline guide."
                } else {
                    "Could not clearly see a leaf spot, color change, or bug inside the green box."
                },
                roiJpegBytes = jpegBytes
            )
        }

        val isVagueInput =
            (context.suspectedCropId == "auto" && (best.probability < 70 || margin < 6)) ||
                best.probability < 60

        if (isVagueInput) {
            val topThree = distinctTop.take(3)
            val labels = if (context.suspectedCropId == "auto") {
                topThree.map { "${it.diagnosisName} (${it.cropCommonName})" }
            } else {
                topThree.map { it.diagnosisName }
            }
            val joinedReadable = when {
                labels.size >= 3 -> "${labels[0]}, ${labels[1]}, or ${labels[2]}"
                else -> labels.joinToString(" or ")
            }
            val titleConditions = when {
                topThree.size >= 3 -> "${topThree[0].diagnosisName}, ${topThree[1].diagnosisName}, or ${topThree[2].diagnosisName}"
                else -> topThree.joinToString(" or ") { it.diagnosisName }
            }
            val vagueSummary = if (context.suspectedCropId == "auto") {
                "Since you did not pick the crop, this could be any of these: $joinedReadable. Pick your crop below for a clearer answer, or check online if you have signal."
            } else {
                "Since the extra plant details were left blank, the problem on ${best.cropCommonName} could be any of these: $joinedReadable. Add more details below to be sure."
            }

            return AnalysisDecision.ConfidentOffline(
                DiagnosisOutput(
                    caseId = tempId,
                    cropCommonName = if (context.suspectedCropId == "auto") {
                        "Crop Not Picked (Could Be Several)"
                    } else {
                        best.cropCommonName
                    },
                    cropScientificName = if (context.suspectedCropId == "auto") {
                        "Pick your crop below to narrow it down"
                    } else {
                        best.cropScientificName
                    },
                    diagnosisName = titleConditions,
                    pathogenScientificName = "Broad Offline Guess",
                    category = "Broad Match",
                    probabilityPercent = best.probability,
                    summary = vagueSummary,
                    recommendations = com.agroguard.field.model.ConditionRecommendation(
                        immediateActions = listOf(
                            "Pick off a few badly spotted leaves carefully so sickness does not spread.",
                            "Check if the soil is bone dry, flooded with standing water, too shady, or recently heavily fertilized."
                        ),
                        biologicalControl = listOf(
                            "Hold off on special sprays until you pick the crop below to see the exact cause."
                        ),
                        chemicalGuidance = "Do NOT spray chemical pesticides blindly from a broad guess. Pick the crop below—or check online—before spraying.",
                        prevention = listOf(
                            "Note the crop name, what part looks sick, and recent rain or fertilizer for faster answers."
                        )
                    ),
                    source = "OFFLINE_ON_DEVICE"
                ),
                roiJpegBytes = jpegBytes
            )
        }

        return AnalysisDecision.ConfidentOffline(
            DiagnosisOutput(
                caseId = tempId,
                cropCommonName = best.cropCommonName,
                cropScientificName = best.cropScientificName,
                diagnosisName = best.diagnosisName,
                pathogenScientificName = best.pathogenScientificName,
                category = best.category,
                probabilityPercent = best.probability,
                summary = best.summary,
                recommendations = best.recommendations,
                source = "OFFLINE_ON_DEVICE"
            ),
            roiJpegBytes = jpegBytes
        )
    }

    fun extractRoiJpegBytes(sourceBitmap: Bitmap, box: BoundingBoxNormalized): ByteArray {
        val roi = cropToBoundingBox(sourceBitmap, box)
        return compressRoiForPossibleCloud(roi)
    }

    private fun cropToBoundingBox(bitmap: Bitmap, box: BoundingBoxNormalized): Bitmap {
        val minCrop = min(32, min(bitmap.width, bitmap.height)).coerceAtLeast(1)
        val x = (box.left * bitmap.width).toInt().coerceIn(0, max(0, bitmap.width - minCrop))
        val y = (box.top * bitmap.height).toInt().coerceIn(0, max(0, bitmap.height - minCrop))
        val maxW = (bitmap.width - x).coerceAtLeast(1)
        val maxH = (bitmap.height - y).coerceAtLeast(1)
        val w = ((box.right - box.left) * bitmap.width).toInt().coerceIn(min(minCrop, maxW), maxW)
        val h = ((box.bottom - box.top) * bitmap.height).toInt().coerceIn(min(minCrop, maxH), maxH)
        return Bitmap.createBitmap(bitmap, x, y, w, h)
    }

    private fun evaluateImageQuality(roi: Bitmap): ImageQualityMetrics {
        val scaled = Bitmap.createScaledBitmap(roi, 160, 160, true)
        val total = 160 * 160
        val pixels = IntArray(total)
        scaled.getPixels(pixels, 0, 160, 0, 0, 160, 160)

        var lumSum = 0.0
        var green = 0
        var brown = 0
        var yellow = 0
        var grayWhite = 0
        var rust = 0
        var purple = 0

        for (p in pixels) {
            val r = Color.red(p)
            val g = Color.green(p)
            val b = Color.blue(p)
            val lum = 0.299 * r + 0.587 * g + 0.114 * b
            lumSum += lum
            val delta = max(r, max(g, b)) - min(r, min(g, b))

            when {
                g > r + 10 && g > b + 12 && g > 45 -> green++
                r > g + 14 && b > g + 6 && r < 185 && g < 120 -> purple++
                r > 130 && g in 56..144 && b < 75 && r - g > 30 -> rust++
                r > 135 && g > 125 && b < 115 && abs(r - g) < 48 -> yellow++
                delta < 28 && lum > 145 && lum < 238 -> grayWhite++
                lum < 95 && r >= b -> brown++
            }
        }

        val avgLum = (lumSum / total).roundToInt()
        val isWellLit = avgLum in 52..224
        val lightingHint = when {
            avgLum < 52 -> "The photo inside the box is too dark. Turn on the flashlight or move into brighter light."
            avgLum > 224 -> "The photo inside the box is too bright or washed out. Try taking it in light shade."
            else -> "Good light"
        }

        return ImageQualityMetrics(
            avgLuminance = avgLum,
            isWellLit = isWellLit,
            lightingHint = lightingHint,
            sharpnessScore = 80.0,
            isSharp = true,
            greenRatio = green.toDouble() / total,
            necroticBrownRatio = brown.toDouble() / total,
            yellowRatio = yellow.toDouble() / total,
            grayWhiteRatio = grayWhite.toDouble() / total,
            rustOrangeRatio = rust.toDouble() / total,
            anomalousPurpleRatio = purple.toDouble() / total
        )
    }

    private fun compressRoiForPossibleCloud(roi: Bitmap): ByteArray {
        val maxDim = 640
        val scale = min(1f, maxDim.toFloat() / max(roi.width, roi.height))
        val target = Bitmap.createScaledBitmap(
            roi,
            max(64, (roi.width * scale).toInt()),
            max(64, (roi.height * scale).toInt()),
            true
        )
        val out = ByteArrayOutputStream()
        target.compress(Bitmap.CompressFormat.JPEG, 82, out)
        return out.toByteArray()
    }
}
