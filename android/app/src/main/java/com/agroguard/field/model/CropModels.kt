package com.agroguard.field.model

import kotlinx.serialization.Serializable

@Serializable
data class ConditionRecommendation(
    val immediateActions: List<String>,
    val biologicalControl: List<String>,
    val chemicalGuidance: String,
    val prevention: List<String>
)

@Serializable
data class VisualSignature(
    val dominantTrait: String,
    val minNecroticRatio: Double? = null,
    val minYellowRatio: Double? = null,
    val minRustRatio: Double? = null,
    val minGrayWhiteRatio: Double? = null
)

@Serializable
data class CropCondition(
    val id: String,
    val name: String,
    val scientificName: String,
    val category: String,
    val affectedParts: List<String>,
    val symptomTags: List<String>,
    val growthStages: List<String>,
    val weatherTriggers: List<String>,
    val summary: String,
    val visualSignature: VisualSignature,
    val recommendations: ConditionRecommendation
)

@Serializable
data class AbioticCondition(
    val id: String,
    val name: String,
    val scientificName: String,
    val category: String,
    val affectedParts: List<String>,
    val symptomTags: List<String>,
    val growthStages: List<String>,
    val weatherTriggers: List<String>,
    val soilTriggers: List<String> = emptyList(),
    val sunlightTriggers: List<String> = emptyList(),
    val inputTriggers: List<String> = emptyList(),
    val summary: String,
    val visualSignature: VisualSignature,
    val recommendations: ConditionRecommendation
)

@Serializable
data class CropEntry(
    val id: String,
    val commonName: String,
    val scientificName: String,
    val family: String,
    val globalRegions: String,
    val leafAspectHint: String,
    val conditions: List<CropCondition>
)

data class FarmerContextInput(
    val suspectedCropId: String = "auto",
    val plantPart: String = "unknown",
    val primarySymptom: String = "unknown",
    val growthStage: String = "unknown",
    val fieldCondition: String = "unknown",
    val soilMoisture: String = "unknown",
    val sunlightExposure: String = "unknown",
    val recentInputs: String = "unknown"
)

data class BoundingBoxNormalized(
    val left: Float = 0.15f,
    val top: Float = 0.15f,
    val right: Float = 0.85f,
    val bottom: Float = 0.85f
)

data class ImageQualityMetrics(
    val avgLuminance: Int,
    val isWellLit: Boolean,
    val lightingHint: String,
    val sharpnessScore: Double,
    val isSharp: Boolean,
    val greenRatio: Double,
    val necroticBrownRatio: Double,
    val yellowRatio: Double,
    val grayWhiteRatio: Double,
    val rustOrangeRatio: Double,
    val anomalousPurpleRatio: Double
)

data class DiagnosisOutput(
    val caseId: String,
    val cropCommonName: String,
    val cropScientificName: String,
    val diagnosisName: String,
    val pathogenScientificName: String,
    val category: String,
    val probabilityPercent: Int,
    val summary: String,
    val recommendations: ConditionRecommendation,
    val source: String, // "OFFLINE_ON_DEVICE" or "GEMINI_CLOUD"
    val transportUsed: String? = null
)

sealed class AnalysisDecision {
    data class ConfidentOffline(
        val output: DiagnosisOutput,
        val roiJpegBytes: ByteArray = ByteArray(0)
    ) : AnalysisDecision()
    data class UnresolvedNeedCloud(
        val tempCaseId: String,
        val reason: String,
        val roiJpegBytes: ByteArray
    ) : AnalysisDecision()
}
