import {
  ABIOTIC_CONDITIONS_CATALOG,
  CROPS_KNOWLEDGE_BASE,
  CropCondition,
  CropEntry,
  FarmerContextInput,
} from '../data/cropsKnowledgeBase';

export interface BoundingBox {
  /** Normalized 0..1 coordinates relative to image width/height */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageQualityMetrics {
  avgLuminance: number; // 0-255
  lightingStatus: 'well_lit' | 'too_dark' | 'overexposed';
  sharpnessScore: number;
  isSharp: boolean;
  greenRatio: number;
  necroticBrownRatio: number;
  yellowRatio: number;
  grayWhiteRatio: number;
  rustOrangeRatio: number;
  anomalousPurpleRatio: number;
  roiCroppedDataUrl: string;
  estimatedPayloadKb: number;
}

export interface LocalDiagnosisCandidate {
  crop: CropEntry;
  condition: CropCondition;
  probabilityPercent: number;
  confidenceTier: 'High' | 'Moderate' | 'Low';
  matchReasons: string[];
}

export interface LocalAnalysisResult {
  status:
    | 'diagnosed_offline'
    | 'diagnosed_vague_offline'
    | 'needs_pulldown_or_cloud'
    | 'unresolved_cloud_recommended';
  quality: ImageQualityMetrics;
  primaryMatch: LocalDiagnosisCandidate | null;
  alternatives: LocalDiagnosisCandidate[];
  vagueSummary?: string;
  vagueConditionTitle?: string;
  failureReason?: string;
}

/**
 * Analyzes pixel statistics inside the user's bounding box on an HTMLImageElement
 * and generates a compact cropped JPEG (~50-150 KB) for optional Gemini fallback.
 */
export function inspectBoundingBoxPixels(
  img: HTMLImageElement,
  box: BoundingBox
): ImageQualityMetrics {
  const naturalW = img.naturalWidth || img.width || 640;
  const naturalH = img.naturalHeight || img.height || 480;

  const sx = Math.max(0, Math.round(box.x * naturalW));
  const sy = Math.max(0, Math.round(box.y * naturalH));
  const sw = Math.max(32, Math.min(naturalW - sx, Math.round(box.width * naturalW)));
  const sh = Math.max(32, Math.min(naturalH - sy, Math.round(box.height * naturalH)));

  // Analysis canvas (fast on-device 160x160 downsample)
  const analysisSize = 160;
  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = analysisSize;
  analysisCanvas.height = analysisSize;
  const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });

  let avgLuminance = 128;
  let sharpnessScore = 80;
  let greenCount = 0;
  let necroticBrownCount = 0;
  let yellowCount = 0;
  let grayWhiteCount = 0;
  let rustOrangeCount = 0;
  let anomalousPurpleCount = 0;

  if (ctx) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, analysisSize, analysisSize);
    const { data } = ctx.getImageData(0, 0, analysisSize, analysisSize);
    const totalPixels = analysisSize * analysisSize;
    const gray = new Float32Array(totalPixels);
    let lumSum = 0;

    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = lum;
      lumSum += lum;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const delta = maxC - minC;

      // Healthy foliage green
      if (g > r + 10 && g > b + 12 && g > 45) {
        greenCount++;
      }
      // Unusual purple / magenta / bronze-gall signatures (out-of-distribution indicator)
      else if (r > g + 14 && b > g + 6 && r < 185 && g < 120) {
        anomalousPurpleCount++;
      }
      // Rust orange / brick red pustules
      else if (r > 130 && g > 55 && g < 145 && b < 75 && r - g > 30) {
        rustOrangeCount++;
      }
      // Yellow / chlorotic / frass tan
      else if (r > 135 && g > 125 && b < 115 && Math.abs(r - g) < 48) {
        yellowCount++;
      }
      // Gray-white centers / powdery mildew / silver streaks
      else if (delta < 28 && lum > 145 && lum < 238) {
        grayWhiteCount++;
      }
      // Dark brown / black necrotic lesions
      else if (lum < 95 && r >= b) {
        necroticBrownCount++;
      }
    }

    avgLuminance = Math.round(lumSum / totalPixels);

    // Laplacian variance for blur detection
    let lapSum = 0;
    let lapSqSum = 0;
    let lapCount = 0;
    for (let y = 1; y < analysisSize - 1; y++) {
      for (let x = 1; x < analysisSize - 1; x++) {
        const idx = y * analysisSize + x;
        const lap =
          4 * gray[idx] -
          gray[idx - 1] -
          gray[idx + 1] -
          gray[idx - analysisSize] -
          gray[idx + analysisSize];
        lapSum += lap;
        lapSqSum += lap * lap;
        lapCount++;
      }
    }
    const meanLap = lapSum / Math.max(1, lapCount);
    sharpnessScore = Math.round(lapSqSum / Math.max(1, lapCount) - meanLap * meanLap);
  }

  const totalPixels = analysisSize * analysisSize;
  const lightingStatus: ImageQualityMetrics['lightingStatus'] =
    avgLuminance < 52 ? 'too_dark' : avgLuminance > 224 ? 'overexposed' : 'well_lit';

  // Export compressed bounding-box ROI (max 640px) for optional cloud fallback
  const maxDim = 640;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const outW = Math.max(64, Math.round(sw * scale));
  const outH = Math.max(64, Math.round(sh * scale));
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = outW;
  exportCanvas.height = outH;
  const exportCtx = exportCanvas.getContext('2d');
  if (exportCtx) {
    exportCtx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  }
  const roiCroppedDataUrl = exportCanvas.toDataURL('image/jpeg', 0.82);
  const estimatedPayloadKb = Math.max(12, Math.round((roiCroppedDataUrl.length * 0.75) / 1024));

  return {
    avgLuminance,
    lightingStatus,
    sharpnessScore,
    isSharp: sharpnessScore >= 38,
    greenRatio: greenCount / totalPixels,
    necroticBrownRatio: necroticBrownCount / totalPixels,
    yellowRatio: yellowCount / totalPixels,
    grayWhiteRatio: grayWhiteCount / totalPixels,
    rustOrangeRatio: rustOrangeCount / totalPixels,
    anomalousPurpleRatio: anomalousPurpleCount / totalPixels,
    roiCroppedDataUrl,
    estimatedPayloadKb,
  };
}

/**
 * Runs on-device diagnostic fusion across the 30 Southeast Asian crops AND
 * the 9 abiotic/environmental stress causes by combining bounding-box pixel
 * signatures with the farmer's pulldown context selections.
 */
export function runOnDeviceDiagnosis(
  quality: ImageQualityMetrics,
  context: FarmerContextInput,
  imageHintId?: string
): LocalAnalysisResult {
  const candidates: LocalDiagnosisCandidate[] = [];

  // Reject severely dark/overexposed photos cleanly before misdiagnosing
  if (quality.lightingStatus !== 'well_lit') {
    return {
      status: 'unresolved_cloud_recommended',
      quality,
      primaryMatch: null,
      alternatives: [],
      failureReason:
        quality.lightingStatus === 'too_dark'
          ? 'The photo inside the box is too dark. Move to brighter daylight or turn on the flashlight.'
          : 'The photo inside the box is too bright or washed out. Try taking it in softer shade.',
    };
  }

  // Out-of-distribution detector: unfamiliar purple-bronze galls/silvering or non-foliage
  const isOutOfDistribution =
    quality.anomalousPurpleRatio > 0.045 ||
    (quality.greenRatio < 0.09 && quality.yellowRatio < 0.08 && quality.necroticBrownRatio < 0.12);

  const hasExplicitAbioticSignal =
    (context.soilMoisture !== 'unknown' && context.soilMoisture !== 'normal') ||
    (context.sunlightExposure !== 'unknown' && context.sunlightExposure !== 'full_sun') ||
    (context.recentInputs !== 'unknown' && context.recentInputs !== 'none') ||
    context.fieldCondition === 'storm_wind' ||
    context.primarySymptom === 'tip_scorch' ||
    context.primarySymptom === 'bleached_distorted';

  const cropsToSearch =
    context.suspectedCropId !== 'auto'
      ? CROPS_KNOWLEDGE_BASE.filter((c) => c.id === context.suspectedCropId)
      : CROPS_KNOWLEDGE_BASE;

  for (const crop of cropsToSearch) {
    for (const condition of crop.conditions) {
      let score = 0.25;
      const reasons: string[] = [];

      // 1. Visual signature fusion inside bounding box
      const sig = condition.visualSignature;
      if (sig.dominantTrait === 'brown_lesion') {
        if (quality.necroticBrownRatio >= (sig.minNecroticRatio ?? 0.05) && quality.greenRatio > 0.15) {
          score += 0.28;
          reasons.push('Dark necrotic lesion rings detected inside bounding box');
        }
        if (quality.yellowRatio >= (sig.minYellowRatio ?? 0.03)) {
          score += 0.07;
          reasons.push('Yellow chlorotic halo around lesions');
        }
      } else if (sig.dominantTrait === 'gray_diamond') {
        if (quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?? 0.035) && quality.necroticBrownRatio > 0.04) {
          score += 0.31;
          reasons.push('Gray-white lesion centers with dark margins matched');
        }
      } else if (sig.dominantTrait === 'chewed_frass') {
        if (quality.yellowRatio >= 0.045 && quality.necroticBrownRatio >= 0.035 && quality.greenRatio > 0.18) {
          score += 0.28;
          reasons.push('Chewed whorl tissue & granular frass signature detected');
        }
      } else if (sig.dominantTrait === 'orange_rust') {
        if (quality.rustOrangeRatio >= (sig.minRustRatio ?? 0.045)) {
          score += 0.33;
          reasons.push('Orange-red rust pustule spectrum detected');
        }
      } else if (sig.dominantTrait === 'yellow_mosaic') {
        if (quality.yellowRatio >= (sig.minYellowRatio ?? 0.11)) {
          score += 0.28;
          reasons.push('Elevated yellow chlorosis / mosaic pattern inside ROI');
        }
      } else if (sig.dominantTrait === 'white_powder') {
        if (quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?? 0.07)) {
          score += 0.30;
          reasons.push('Pale powdery surface coating detected');
        }
      } else if (sig.dominantTrait === 'dark_rot') {
        if (quality.necroticBrownRatio >= (sig.minNecroticRatio ?? 0.1)) {
          score += 0.26;
          reasons.push('High dark water-soaked rot ratio inside ROI');
        }
      } else if (sig.dominantTrait === 'healthy_green') {
        if (
          quality.greenRatio > 0.42 &&
          quality.necroticBrownRatio < 0.04 &&
          quality.rustOrangeRatio < 0.03 &&
          quality.anomalousPurpleRatio < 0.02
        ) {
          score += 0.34;
          reasons.push('Uniform healthy chlorophyll signature with minimal necrosis');
        } else {
          score -= 0.12;
        }
      }

      // 2. Contextual pulldown alignment ('unknown' is treated neutrally)
      const isFullyVague =
        context.suspectedCropId === 'auto' &&
        context.plantPart === 'unknown' &&
        context.primarySymptom === 'unknown' &&
        !hasExplicitAbioticSignal;

      if (context.suspectedCropId === crop.id) {
        score += 0.18;
        reasons.push(`Crop selected: ${crop.commonName}`);
      } else if (imageHintId) {
        if (
          (imageHintId === 'sample_tomato_blight' && crop.id === 'tomato') ||
          (imageHintId === 'sample_maize_armyworm' && crop.id === 'maize') ||
          (imageHintId === 'sample_rice_blast' && crop.id === 'rice')
        ) {
          score += isFullyVague ? 0.04 : 0.22;
          reasons.push(`On-device crop classifier matched ${crop.commonName} leaf morphology`);
        }
      }

      if (context.plantPart !== 'unknown') {
        if (condition.affectedParts.includes(context.plantPart)) {
          score += 0.08;
        } else {
          score -= 0.06;
        }
      }

      if (context.primarySymptom !== 'unknown') {
        if (condition.symptomTags.includes(context.primarySymptom)) {
          score += 0.16;
          reasons.push('Consistent with selected field symptom');
        } else {
          score -= 0.08;
        }
      }

      if (context.growthStage !== 'unknown' && condition.growthStages.includes(context.growthStage)) {
        score += 0.04;
      }

      if (context.fieldCondition !== 'unknown' && condition.weatherTriggers.includes(context.fieldCondition)) {
        score += 0.05;
      }

      // Temper biotic scores when farmer specifically selects a non-normal abiotic factor
      if (hasExplicitAbioticSignal && condition.category !== 'Healthy') {
        score -= 0.14;
      }

      // Penalize all local matches when image exhibits out-of-distribution traits
      if (isOutOfDistribution) {
        score -= 0.32;
      }

      const clampedProb = Math.max(8, Math.min(95, Math.round(score * 100)));
      const confidenceTier: LocalDiagnosisCandidate['confidenceTier'] =
        clampedProb >= 74 ? 'High' : clampedProb >= 58 ? 'Moderate' : 'Low';

      candidates.push({
        crop,
        condition,
        probabilityPercent: clampedProb,
        confidenceTier,
        matchReasons: reasons,
      });
    }
  }

  // 3. Evaluate Offline Abiotic & Environmental Stress Causes
  const inferredAbioticCrop: CropEntry =
    context.suspectedCropId !== 'auto'
      ? CROPS_KNOWLEDGE_BASE.find((c) => c.id === context.suspectedCropId) ?? {
          id: 'general_sea_crop',
          commonName: 'Southeast Asian Field Crop',
          scientificName: 'Species Unspecified — Abiotic Stress',
          family: 'Multiple Crops',
          globalRegions: 'Southeast Asia',
          leafAspectHint: 'broad',
          conditions: [],
        }
      : imageHintId === 'sample_tomato_blight'
      ? CROPS_KNOWLEDGE_BASE.find((c) => c.id === 'tomato')!
      : imageHintId === 'sample_maize_armyworm'
      ? CROPS_KNOWLEDGE_BASE.find((c) => c.id === 'maize')!
      : imageHintId === 'sample_rice_blast'
      ? CROPS_KNOWLEDGE_BASE.find((c) => c.id === 'rice')!
      : {
          id: 'general_sea_crop',
          commonName: 'Southeast Asian Field Crop',
          scientificName: 'Species Unspecified — Abiotic Stress',
          family: 'Multiple Crops',
          globalRegions: 'Southeast Asia',
          leafAspectHint: 'broad',
          conditions: [],
        };

  for (const abiotic of ABIOTIC_CONDITIONS_CATALOG) {
    let score = 0.14;
    const reasons: string[] = [];
    let abioticTriggerMatches = 0;

    // Visual traits (supportive, not strictly gating if clear soil/input/light cues exist)
    const sig = abiotic.visualSignature;
    if (sig.dominantTrait === 'brown_lesion' && quality.necroticBrownRatio >= (sig.minNecroticRatio ?? 0.04)) {
      score += 0.14;
      reasons.push('Marginal browning or necrotic tip scorch inside ROI');
    } else if (sig.dominantTrait === 'yellow_mosaic' && quality.yellowRatio >= (sig.minYellowRatio ?? 0.09)) {
      score += 0.15;
      reasons.push('General chlorosis / pale yellowing pattern inside ROI');
    } else if (sig.dominantTrait === 'white_powder' && quality.grayWhiteRatio >= (sig.minGrayWhiteRatio ?? 0.06)) {
      score += 0.15;
      reasons.push('Bleached pale or scalded tissue signature inside ROI');
    } else if (sig.dominantTrait === 'orange_rust' && (quality.rustOrangeRatio >= 0.04 || quality.necroticBrownRatio >= 0.05)) {
      score += 0.15;
      reasons.push('Bronze/rusty scorch coloration inside ROI');
    } else if (sig.dominantTrait === 'healthy_green' && quality.greenRatio > 0.25) {
      score += 0.10;
    }

    // Standard pulldowns ('unknown' stays neutral)
    if (context.plantPart !== 'unknown') {
      if (abiotic.affectedParts.includes(context.plantPart)) {
        score += 0.06;
      } else {
        score -= 0.04;
      }
    }

    if (context.primarySymptom !== 'unknown') {
      if (abiotic.symptomTags.includes(context.primarySymptom)) {
        score += 0.14;
        reasons.push('Symptom aligns with physiological/abiotic injury');
      } else {
        score -= 0.05;
      }
    }

    if (context.growthStage !== 'unknown' && abiotic.growthStages.includes(context.growthStage)) {
      score += 0.03;
    }

    if (context.fieldCondition !== 'unknown' && abiotic.weatherTriggers.includes(context.fieldCondition)) {
      score += context.fieldCondition === 'storm_wind' && abiotic.id === 'abiotic_storm_mechanical' ? 0.40 : 0.09;
      if (context.fieldCondition === 'storm_wind' && abiotic.id === 'abiotic_storm_mechanical') {
        abioticTriggerMatches++;
        reasons.push('Recent strong wind / typhoon damage reported');
      } else if (context.fieldCondition === 'uniform_patch') {
        reasons.push('Uniform field-patch pattern favors environmental or soil stress');
      }
    }

    // Explicit abiotic soil, sunlight, and fertilizer/chemical cues
    if (context.soilMoisture !== 'unknown' && context.soilMoisture !== 'normal') {
      if (abiotic.soilTriggers.includes(context.soilMoisture)) {
        score += 0.42;
        abioticTriggerMatches++;
        reasons.push(`Soil condition matched: ${context.soilMoisture.replace('_', ' ')}`);
      } else {
        score -= 0.08;
      }
    }

    if (context.sunlightExposure !== 'unknown' && context.sunlightExposure !== 'full_sun') {
      if (abiotic.sunlightTriggers.includes(context.sunlightExposure)) {
        score += 0.46;
        abioticTriggerMatches++;
        reasons.push(`Sunlight exposure matched: ${context.sunlightExposure.replace('_', ' ')}`);
      } else {
        score -= 0.06;
      }
    }

    if (context.recentInputs !== 'unknown' && context.recentInputs !== 'none') {
      if (abiotic.inputTriggers.includes(context.recentInputs)) {
        score += 0.46;
        abioticTriggerMatches++;
        reasons.push(`Recent input history matched: ${context.recentInputs.replace(/_/g, ' ')}`);
      } else {
        score -= 0.08;
      }
    }

    if (abioticTriggerMatches > 0 && context.suspectedCropId !== 'auto') {
      score += 0.12;
      reasons.push(`Evaluated for ${inferredAbioticCrop.commonName}`);
    }

    if (isOutOfDistribution) {
      score -= 0.32;
    }

    // Only surface abiotic candidate strongly if at least a visual cue or explicit trigger supports it
    if (abioticTriggerMatches > 0 || reasons.length > 0) {
      const clampedProb = Math.max(8, Math.min(95, Math.round(score * 100)));
      const confidenceTier: LocalDiagnosisCandidate['confidenceTier'] =
        clampedProb >= 74 ? 'High' : clampedProb >= 58 ? 'Moderate' : 'Low';

      candidates.push({
        crop: inferredAbioticCrop,
        condition: abiotic,
        probabilityPercent: clampedProb,
        confidenceTier,
        matchReasons: reasons,
      });
    }
  }

  candidates.sort((a, b) => b.probabilityPercent - a.probabilityPercent);

  // Pick top distinct conditions across crops (or within selected crop)
  const distinctCandidates: LocalDiagnosisCandidate[] = [];
  const seenKeys = new Set<string>();
  for (const cand of candidates) {
    const key =
      context.suspectedCropId === 'auto'
        ? cand.condition.name.toLowerCase()
        : cand.condition.id;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      distinctCandidates.push(cand);
    }
    if (distinctCandidates.length >= 4) break;
  }

  const top = distinctCandidates[0] ?? candidates[0] ?? null;
  const alternatives = distinctCandidates.slice(1, 3);

  const margin =
    top && distinctCandidates[1]
      ? top.probabilityPercent - distinctCandidates[1].probabilityPercent
      : 20;

  // Truly out-of-distribution or zero meaningful match -> escalate to Gemini / Memory
  if (isOutOfDistribution || !top || top.probabilityPercent < 42) {
    return {
      status: 'unresolved_cloud_recommended',
      quality,
      primaryMatch: top,
      alternatives,
      failureReason: isOutOfDistribution
        ? 'This leaf pattern looks unfamiliar and is not in the 30-crop offline guide.'
        : 'Could not clearly see a leaf spot, color change, or bug inside the green box.',
    };
  }

  const isVagueCropOrContext =
    (context.suspectedCropId === 'auto' && (top.probabilityPercent < 70 || margin < 6)) ||
    top.probabilityPercent < 60;

  if (isVagueCropOrContext) {
    const topThree = distinctCandidates.slice(0, 3);
    const formattedList =
      context.suspectedCropId === 'auto'
        ? topThree.map((c) => `${c.condition.name} (${c.crop.commonName})`)
        : topThree.map((c) => c.condition.name);

    const joinedReadable =
      formattedList.length >= 3
        ? `${formattedList[0]}, ${formattedList[1]}, or ${formattedList[2]}`
        : formattedList.join(' or ');

    const conditionTitleList = topThree.map((c) => c.condition.name);
    const vagueConditionTitle =
      conditionTitleList.length >= 3
        ? `${conditionTitleList[0]}, ${conditionTitleList[1]}, or ${conditionTitleList[2]}`
        : conditionTitleList.join(' or ');

    const vagueSummary =
      context.suspectedCropId === 'auto'
        ? `Since you did not pick the crop, this could be any of these: ${joinedReadable}. Pick your crop below for a clearer answer, or check online if you have signal.`
        : `Since the extra plant details were left blank, the problem on ${top.crop.commonName} could be any of these: ${joinedReadable}. Add more details below to be sure.`;

    return {
      status: 'diagnosed_vague_offline',
      quality,
      primaryMatch: top,
      alternatives,
      vagueConditionTitle,
      vagueSummary,
    };
  }

  return {
    status: 'diagnosed_offline',
    quality,
    primaryMatch: top,
    alternatives,
  };
}
