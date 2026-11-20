import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import {
  CROPS_KNOWLEDGE_BASE,
  FarmerContextInput,
} from './data/cropsKnowledgeBase';
import {
  BoundingBox,
  ImageQualityMetrics,
  inspectBoundingBoxPixels,
  LocalAnalysisResult,
  runOnDeviceDiagnosis,
} from './engine/localDiagnosticEngine';
import {
  deleteFieldCaseFromMemory,
  loadSavedCases,
  NetworkSimulationMode,
  requestGeminiCloudDiagnosis,
  resolveNetworkPriority,
  SavedFieldCase,
  saveFieldCase,
} from './services/networkAndStorage';
import { FIELD_SAMPLES } from './components/BoundingBoxViewport';
import { DiagnosisDisplayData } from './components/DiagnosisResultCard';
import { CropCatalogView } from './components/CropCatalogView';
import { SavedCasesView } from './components/SavedCasesView';
import { AndroidSourceView } from './components/AndroidSourceView';
import { AndroidPhoneShell, PhoneTab } from './components/AndroidPhoneShell';
import { CloudPromptStep } from './components/CloudFallbackModals';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';

interface ScenarioPreset {
  id: string;
  title: string;
  subtitle: string;
  sampleId: string;
  imageSrc: string;
  context: FarmerContextInput;
}

const QUICK_SCENARIOS: ScenarioPreset[] = [
  {
    id: 'rice_blast',
    title: 'Rice Blast (Biotic Fungal)',
    subtitle: 'Offline · Leaf lesions + monsoon humidity',
    sampleId: 'sample_rice_blast',
    imageSrc: FIELD_SAMPLES[2].src,
    context: {
      suspectedCropId: 'rice',
      plantPart: 'leaf_upper',
      primarySymptom: 'spots_lesions',
      growthStage: 'vegetative',
      fieldCondition: 'humid_rainy',
      soilMoisture: 'unknown',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'maize_armyworm',
    title: 'Maize Fall Armyworm (Pest)',
    subtitle: 'Offline · Whorl holes & frass',
    sampleId: 'sample_maize_armyworm',
    imageSrc: FIELD_SAMPLES[1].src,
    context: {
      suspectedCropId: 'maize',
      plantPart: 'leaf_upper',
      primarySymptom: 'chewing_holes',
      growthStage: 'vegetative',
      fieldCondition: 'hot_dry',
      soilMoisture: 'unknown',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'drought_stress',
    title: 'Drought / Lack of Water (Abiotic)',
    subtitle: 'Offline · Dry cracked soil + unsure symptom',
    sampleId: 'sample_tomato_blight',
    imageSrc: FIELD_SAMPLES[0].src,
    context: {
      suspectedCropId: 'tomato',
      plantPart: 'unknown',
      primarySymptom: 'unknown',
      growthStage: 'unknown',
      fieldCondition: 'hot_dry',
      soilMoisture: 'dry_cracked',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'overwatering',
    title: 'Overwatering / Waterlogged (Abiotic)',
    subtitle: 'Offline · Standing water + root hypoxia',
    sampleId: 'sample_rice_blast',
    imageSrc: FIELD_SAMPLES[2].src,
    context: {
      suspectedCropId: 'papaya',
      plantPart: 'whole_plant',
      primarySymptom: 'wilting_rot',
      growthStage: 'unknown',
      fieldCondition: 'humid_rainy',
      soilMoisture: 'waterlogged',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'low_sunlight',
    title: 'Too Little Sunlight / Shade (Abiotic)',
    subtitle: 'Offline · Heavy shade etiolation stress',
    sampleId: 'sample_tomato_blight',
    imageSrc: FIELD_SAMPLES[0].src,
    context: {
      suspectedCropId: 'chili',
      plantPart: 'unknown',
      primarySymptom: 'yellowing_mosaic',
      growthStage: 'unknown',
      fieldCondition: 'unknown',
      soilMoisture: 'unknown',
      sunlightExposure: 'heavy_shade',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'fertilizer_burn',
    title: 'Too Much Fertilizer Burn (Abiotic)',
    subtitle: 'Offline · Heavy NPK/urea last 14 days',
    sampleId: 'sample_tomato_blight',
    imageSrc: FIELD_SAMPLES[0].src,
    context: {
      suspectedCropId: 'tomato',
      plantPart: 'leaf_upper',
      primarySymptom: 'tip_scorch',
      growthStage: 'unknown',
      fieldCondition: 'unknown',
      soilMoisture: 'unknown',
      sunlightExposure: 'unknown',
      recentInputs: 'heavy_fertilizer',
    },
  },
  {
    id: 'all_unsure_tomato',
    title: 'All Pulldowns "Do not know"',
    subtitle: 'Offline · Returns broad multi-crop possibilities',
    sampleId: 'sample_tomato_blight',
    imageSrc: FIELD_SAMPLES[0].src,
    context: {
      suspectedCropId: 'auto',
      plantPart: 'unknown',
      primarySymptom: 'unknown',
      growthStage: 'unknown',
      fieldCondition: 'unknown',
      soilMoisture: 'unknown',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
  {
    id: 'mystery_gemini',
    title: 'Unfamiliar Gall Leaf (~5% Fallback)',
    subtitle: 'Cloud · Triggers Gemini Y/N + Memory Y/N',
    sampleId: 'sample_mystery_leaf',
    imageSrc: FIELD_SAMPLES[3].src,
    context: {
      suspectedCropId: 'auto',
      plantPart: 'unknown',
      primarySymptom: 'unknown',
      growthStage: 'unknown',
      fieldCondition: 'unknown',
      soilMoisture: 'unknown',
      sunlightExposure: 'unknown',
      recentInputs: 'unknown',
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<PhoneTab>('scan');
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const browserOnline = useOnlineStatus();
  const [showIOSInstallTip, setShowIOSInstallTip] = useState(false);

  // Image & Bounding Box State
  const [imageSrc, setImageSrc] = useState<string>(FIELD_SAMPLES[0].src);
  const [activeSampleId, setActiveSampleId] = useState<string | undefined>(FIELD_SAMPLES[0].id);
  const [box, setBox] = useState<BoundingBox>({ x: 0.16, y: 0.14, width: 0.68, height: 0.72 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<ImageQualityMetrics | null>(null);

  // Pulldown Contextual Inputs
  const [context, setContext] = useState<FarmerContextInput>({
    suspectedCropId: 'auto',
    plantPart: 'leaf_upper',
    primarySymptom: 'spots_lesions',
    growthStage: 'unknown',
    fieldCondition: 'unknown',
    soilMoisture: 'unknown',
    sunlightExposure: 'unknown',
    recentInputs: 'unknown',
    notes: '',
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Network Priority Simulation (defaults to real browser connectivity)
  const [networkMode, setNetworkMode] = useState<NetworkSimulationMode>('auto');
  const networkReport = useMemo(
    () => resolveNetworkPriority(networkMode),
    [networkMode, browserOnline]
  );

  // Diagnostic Output & Fallback Prompt State
  const [localResult, setLocalResult] = useState<LocalAnalysisResult | null>(null);
  const [displayDiagnosis, setDisplayDiagnosis] = useState<DiagnosisDisplayData | null>(null);
  const [promptStep, setPromptStep] = useState<CloudPromptStep>({ type: 'none' });
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Saved Cases in Local Memory
  const [savedCases, setSavedCases] = useState<SavedFieldCase[]>(() => loadSavedCases());
  const pendingCaseIdRef = useRef<string | null>(null);

  const recomputeQuality = useCallback(() => {
    const img = loadedImageRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    try {
      const metrics = inspectBoundingBoxPixels(img, box);
      setQualityMetrics(metrics);
    } catch {
      // Ignore transient canvas read errors during load
    }
  }, [box]);

  useEffect(() => {
    recomputeQuality();
  }, [recomputeQuality]);

  const handleImageSelected = (src: string, sampleId?: string) => {
    setImageSrc(src);
    setActiveSampleId(sampleId);
    setActiveScenarioId(null);
    setDisplayDiagnosis(null);
    setLocalResult(null);
    setNoticeMessage(null);
    setCloudError(null);
    setPromptStep({ type: 'none' });
    setBox({ x: 0.16, y: 0.14, width: 0.68, height: 0.72 });

    if (sampleId === 'sample_maize_armyworm') {
      setContext((prev) => ({
        ...prev,
        suspectedCropId: 'auto',
        plantPart: 'leaf_upper',
        primarySymptom: 'chewing_holes',
      }));
    } else if (sampleId === 'sample_tomato_blight' || sampleId === 'sample_rice_blast') {
      setContext((prev) => ({
        ...prev,
        suspectedCropId: 'auto',
        plantPart: 'leaf_upper',
        primarySymptom: 'spots_lesions',
      }));
    } else if (sampleId === 'sample_mystery_leaf') {
      setContext((prev) => ({
        ...prev,
        suspectedCropId: 'auto',
        plantPart: 'unknown',
        primarySymptom: 'unknown',
      }));
    }
  };

  const applyQuickScenario = (preset: ScenarioPreset) => {
    setActiveScenarioId(preset.id);
    setImageSrc(preset.imageSrc);
    setActiveSampleId(preset.sampleId);
    setContext(preset.context);
    setDisplayDiagnosis(null);
    setLocalResult(null);
    setNoticeMessage(`Loaded scenario: ${preset.title}. Tap "Run Offline Analysis" on the phone.`);
    setCloudError(null);
    setPromptStep({ type: 'none' });
    setBox({ x: 0.16, y: 0.14, width: 0.68, height: 0.72 });
    setActiveTab('scan');
  };

  const handleImageElementReady = (img: HTMLImageElement) => {
    loadedImageRef.current = img;
    const metrics = inspectBoundingBoxPixels(img, box);
    setQualityMetrics(metrics);
  };

  const runOfflineAnalysis = () => {
    setNoticeMessage(null);
    setCloudError(null);

    let metrics = qualityMetrics;
    if (!metrics && loadedImageRef.current) {
      metrics = inspectBoundingBoxPixels(loadedImageRef.current, box);
      setQualityMetrics(metrics);
    }
    if (!metrics) return;

    const analysis = runOnDeviceDiagnosis(metrics, context, activeSampleId);
    setLocalResult(analysis);

    if (
      (analysis.status === 'diagnosed_offline' ||
        analysis.status === 'diagnosed_vague_offline') &&
      analysis.primaryMatch
    ) {
      const m = analysis.primaryMatch;
      const isVague = analysis.status === 'diagnosed_vague_offline';
      const output: DiagnosisDisplayData = isVague
        ? {
            source: 'offline_engine',
            isVagueMatch: true,
            cropCommonName:
              context.suspectedCropId === 'auto'
                ? 'Crop Not Specified (Multiple Matching Crops)'
                : m.crop.commonName,
            cropScientificName:
              context.suspectedCropId === 'auto'
                ? 'Select Suspected Crop below to narrow'
                : m.crop.scientificName,
            diagnosisName:
              analysis.vagueConditionTitle || m.condition.name,
            pathogenScientificName: 'Broad Offline Match — Vague Inputs',
            category: 'Broad Match',
            probabilityPercent: m.probabilityPercent,
            summary: analysis.vagueSummary || m.condition.summary,
            matchReasons: [
              'Visual traits detected inside bounding box',
              'Inputs left broad / "Do not know"',
            ],
            recommendations: {
              immediateActions: [
                'Isolate or prune a few badly affected leaves carefully while avoiding spreading wet spores.',
                'Check whether surrounding plants show dry/cracked soil, standing water, heavy shade, or recent fertilizer scorch.',
              ],
              biologicalControl: [
                'Hold off on specific bio-fungicides or insecticides until you select the crop in the pulldown to narrow the exact pest or pathogen.',
              ],
              chemicalGuidance:
                'Do NOT apply chemical sprays blindly from a broad match. Specify the crop and primary symptom below—or verify online via Gemini—before spraying.',
              prevention: [
                'Keep field notes on crop name, plant part affected, and recent weather/fertilizer inputs for sharper offline diagnosis.',
              ],
            },
          }
        : {
            source: 'offline_engine',
            cropCommonName: m.crop.commonName,
            cropScientificName: m.crop.scientificName,
            diagnosisName: m.condition.name,
            pathogenScientificName: m.condition.scientificName,
            category: m.condition.category,
            probabilityPercent: m.probabilityPercent,
            summary: m.condition.summary,
            matchReasons: m.matchReasons,
            recommendations: m.condition.recommendations,
          };
      setDisplayDiagnosis(output);

      const caseId = `case_${Date.now()}`;
      const updated = saveFieldCase({
        id: caseId,
        createdAt: new Date().toISOString(),
        source: 'offline_engine',
        cropCommonName: output.cropCommonName,
        cropScientificName: output.cropScientificName,
        diagnosisName: output.diagnosisName,
        pathogenScientificName: output.pathogenScientificName,
        category: output.category,
        probabilityPercent: output.probabilityPercent,
        summary: output.summary,
        recommendations: output.recommendations,
        roiImageDataUrl: metrics.roiCroppedDataUrl,
        context,
      });
      setSavedCases(updated);
      setPromptStep({ type: 'none' });
    } else {
      setDisplayDiagnosis(null);
      pendingCaseIdRef.current = `case_${Date.now()}`;
      const reason =
        analysis.failureReason ||
        'Offline model could not identify this crop pest or disease with sufficient confidence.';

      if (networkReport.isConnected) {
        setPromptStep({
          type: 'ask_gemini_yn',
          reason,
          payloadKb: metrics.estimatedPayloadKb,
        });
      } else {
        setPromptStep({
          type: 'ask_delete_memory_yn',
          reason: `${reason} No Wi-Fi or Telco signal is available right now.`,
        });
      }
    }
  };

  const triggerManualGeminiPrompt = () => {
    if (!qualityMetrics) return;
    setCloudError(null);
    pendingCaseIdRef.current = `case_${Date.now()}`;
    if (networkReport.isConnected) {
      setPromptStep({
        type: 'ask_gemini_yn',
        reason: 'Requested second-opinion cloud analysis for this framed sample.',
        payloadKb: qualityMetrics.estimatedPayloadKb,
      });
    } else {
      setPromptStep({
        type: 'ask_delete_memory_yn',
        reason: 'No Wi-Fi or Telco signal is currently available to reach Gemini.',
      });
    }
  };

  const executeGeminiCloudCall = async (
    roiDataUrl: string,
    payloadKb: number,
    caseIdToReplace?: string,
    caseContext: FarmerContextInput = context
  ) => {
    setIsCloudLoading(true);
    setCloudError(null);
    try {
      const cloudRes = await requestGeminiCloudDiagnosis({
        roiImageDataUrl: roiDataUrl,
        transportUsed: networkReport.activeTransport,
        context: caseContext,
      });

      const output: DiagnosisDisplayData = {
        source: 'gemini_cloud',
        transportUsed: networkReport.activeTransport,
        cropCommonName: cloudRes.cropCommonName,
        cropScientificName: cloudRes.cropScientificName,
        diagnosisName: cloudRes.diagnosisName,
        pathogenScientificName: cloudRes.pathogenScientificName,
        category: cloudRes.category,
        probabilityPercent: cloudRes.probabilityPercent,
        summary: cloudRes.reasoning,
        recommendations: cloudRes.recommendations,
        payloadKb,
      };
      setDisplayDiagnosis(output);
      setPromptStep({ type: 'none' });

      const updated = saveFieldCase({
        id: caseIdToReplace ?? `case_${Date.now()}`,
        createdAt: new Date().toISOString(),
        source: 'gemini_cloud',
        transportUsed: networkReport.activeTransport,
        cropCommonName: output.cropCommonName,
        cropScientificName: output.cropScientificName,
        diagnosisName: output.diagnosisName,
        pathogenScientificName: output.pathogenScientificName,
        category: output.category,
        probabilityPercent: output.probabilityPercent,
        summary: output.summary,
        recommendations: output.recommendations,
        roiImageDataUrl: roiDataUrl,
        context: caseContext,
        payloadKb,
      });
      setSavedCases(updated);
      setNoticeMessage(
        `Diagnosed via Gemini using ${
          networkReport.activeTransport === 'telco' ? 'Telco Cellular' : 'Wi-Fi (Priority 1)'
        } (${payloadKb} KB).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cloud request failed.';
      setCloudError(msg);
      if (promptStep.type === 'none') {
        setNoticeMessage(msg);
      }
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleRespondGemini = async (proceedYes: boolean) => {
    if (!proceedYes) {
      setCloudError(null);
      setPromptStep({
        type: 'ask_delete_memory_yn',
        reason: 'Gemini cloud analysis declined.',
      });
      return;
    }

    if (!qualityMetrics) return;
    await executeGeminiCloudCall(
      qualityMetrics.roiCroppedDataUrl,
      qualityMetrics.estimatedPayloadKb,
      pendingCaseIdRef.current ?? undefined,
      context
    );
  };

  const handleRespondDelete = (deleteYes: boolean) => {
    const id = pendingCaseIdRef.current ?? `case_${Date.now()}`;
    setPromptStep({ type: 'none' });

    if (deleteYes) {
      const updated = deleteFieldCaseFromMemory(id);
      setSavedCases(updated);
      setDisplayDiagnosis(null);
      setLocalResult(null);
      setNoticeMessage('Unresolved case and photo were deleted from phone memory.');
    } else if (qualityMetrics) {
      const cropLabel =
        context.suspectedCropId === 'auto'
          ? 'Unidentified Crop'
          : CROPS_KNOWLEDGE_BASE.find((c) => c.id === context.suspectedCropId)?.commonName ??
            'Unidentified Crop';

      const updated = saveFieldCase({
        id,
        createdAt: new Date().toISOString(),
        source: 'unresolved_saved',
        cropCommonName: cropLabel,
        cropScientificName: 'Pending Identification',
        diagnosisName: 'Unresolved Disease / Pest',
        pathogenScientificName: 'Awaiting Gemini Online Review',
        category: 'Unresolved',
        probabilityPercent: 0,
        summary:
          localResult?.failureReason ||
          'Kept in phone memory for later review or Gemini cloud analysis.',
        recommendations: {
          immediateActions: [
            'Isolate sample area if symptoms appear to spread rapidly while awaiting confirmation.',
          ],
          biologicalControl: ['Avoid broad-spectrum spraying until pest or pathogen is confirmed.'],
          chemicalGuidance: 'Do not apply targeted chemicals without confirmed identification.',
          prevention: ['Retry analysis in Saved Cases once Wi-Fi or Telco signal is available.'],
        },
        roiImageDataUrl: qualityMetrics.roiCroppedDataUrl,
        context,
        payloadKb: qualityMetrics.estimatedPayloadKb,
      });
      setSavedCases(updated);
      setNoticeMessage('Unresolved case retained in phone memory.');
    }
  };

  const handleDeleteSavedCase = (caseId: string) => {
    setSavedCases(deleteFieldCaseFromMemory(caseId));
  };

  const handleRetrySavedCase = async (entry: SavedFieldCase) => {
    if (!networkReport.isConnected) return;
    await executeGeminiCloudCall(
      entry.roiImageDataUrl,
      entry.payloadKb ?? 64,
      entry.id,
      entry.context
    );
    setActiveTab('scan');
  };

  const sharedPhoneProps = {
    activeTab,
    onTabChange: setActiveTab,
    imageSrc,
    activeSampleId,
    box,
    onBoxChange: setBox,
    onImageSelected: handleImageSelected,
    onImageElementReady: handleImageElementReady,
    qualityMetrics,
    context,
    onContextChange: setContext,
    networkReport,
    browserOnline,
    noticeMessage,
    onDismissNotice: () => setNoticeMessage(null),
    onRunOfflineAnalysis: runOfflineAnalysis,
    onVerifyOnlineClick: triggerManualGeminiPrompt,
    displayDiagnosis,
    localResult,
    savedCases,
    onDeleteCase: handleDeleteSavedCase,
    onRetryGeminiForSavedCase: handleRetrySavedCase,
    isCloudLoading,
    promptStep,
    cloudError,
    onRespondGemini: handleRespondGemini,
    onRespondDelete: handleRespondDelete,
  };

  return (
    <div className="min-h-screen bg-[#F6F7F4] text-[#182019]">
      {/* Mobile / Narrow Viewport: Native Edge-to-Edge Android Material 3 UI */}
      <div className="lg:hidden">
        <AndroidPhoneShell framed={false} {...sharedPhoneProps} />
      </div>

      {/* Desktop / Wide Viewport: 3-Zone Top Bar + Interactive Android Phone Preview */}
      <div className="hidden lg:block pb-12">
        <header className="sticky top-0 z-30 border-b border-[#DCE2D7] bg-[#F6F7F4]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3">
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className="font-display text-lg font-bold tracking-tight text-[#14532D] whitespace-nowrap shrink-0"
            >
              CropAnalyzer
            </button>

            <nav
              aria-label="Primary navigation"
              className="flex items-center gap-6 text-sm font-medium text-[#475449]"
            >
              {(
                [
                  ['scan', 'Android Preview'],
                  ['crops', '30 SEA Crops'],
                  ['cases', `Saved Cases (${savedCases.length})`],
                  ['android', 'Android Source'],
                ] as [PhoneTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === id
                      ? 'border-b-2 border-[#1B5E20] font-semibold text-[#182019]'
                      : 'hover:text-[#182019]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex items-center shrink-0">
              {isInstallable && !isInstalled ? (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install App
                </button>
              ) : isIOS && !isInstalled ? (
                <button
                  type="button"
                  onClick={() => setShowIOSInstallTip((v) => !v)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4DBD0] bg-white px-4 py-2 text-xs font-semibold text-[#182019] hover:bg-[#F0F2ED] whitespace-nowrap shrink-0"
                >
                  Install on iOS
                </button>
              ) : (
                <a
                  href="/api/android-project.zip"
                  download="CropAnalyzer-Android.zip"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#14532D] whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Android Studio ZIP
                </a>
              )}
            </div>
          </div>
        </header>

        {showIOSInstallTip && (
          <div className="mx-auto mt-3 max-w-6xl px-6">
            <div className="flex items-center justify-between rounded-xl border border-[#DCE2D7] bg-white px-4 py-3 text-xs text-[#2C372E]">
              <span>
                To install on iOS: tap <strong>Share</strong> in Safari, then choose{' '}
                <strong>Add to Home Screen</strong>.
              </span>
              <button
                type="button"
                onClick={() => setShowIOSInstallTip(false)}
                className="ml-4 font-semibold text-[#1B5E20]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-6 py-6">
          {activeTab === 'scan' && (
            <div className="grid grid-cols-12 items-start gap-8">
              {/* Left Column: Field Scenario Presets & Signal Routing Controls */}
              <div className="col-span-6 space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-[#182019] text-balance">
                    CropAnalyzer Android Preview
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#475449]">
                    Test how CropAnalyzer looks and operates on an Android phone using the interactive Material 3 screen on the right. Select a quick field scenario below or operate the phone screen directly.
                  </p>
                </div>

                {/* Signal Routing Selector */}
                <section className="rounded-2xl border border-[#DCE2D7] bg-white p-5 space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#182019]">
                      Phone Signal Simulator (Wi-Fi Priority 1, Telco 2)
                    </h2>
                    <span className="font-mono-tabular text-xs font-medium text-[#1B5E20]">
                      {networkReport.activeTransport === 'none'
                        ? 'Offline'
                        : networkReport.activeTransport === 'telco'
                        ? 'Telco 5G'
                        : 'Wi-Fi Priority 1'}
                    </span>
                  </div>
                  <select
                    value={networkMode}
                    onChange={(e) => setNetworkMode(e.target.value as NetworkSimulationMode)}
                    className="min-h-[44px] w-full rounded-xl border border-[#D4DBD0] bg-[#FAFBF9] px-3 text-sm text-[#182019] focus:border-[#1B5E20] focus:outline-none"
                  >
                    <option value="auto">Auto (Live Device Signal)</option>
                    <option value="wifi_priority">Test: Wi-Fi + Telco (Wi-Fi Priority 1)</option>
                    <option value="telco_only">Test: Telco Cellular Only</option>
                    <option value="offline">Test: No Signal (Airplane / Offline)</option>
                  </select>
                  <p className="text-xs text-[#5A675C]">
                    Active phone bar route: {networkReport.priorityLabel}
                  </p>
                </section>

                {/* Quick Field Test Scenarios */}
                <section className="rounded-2xl border border-[#DCE2D7] bg-white p-5 space-y-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#182019]">
                      Quick Field Test Scenarios
                    </h2>
                    <p className="mt-0.5 text-xs text-[#5A675C]">
                      Load biotic diseases, abiotic stress (drought, overwatering, low sunlight, fertilizer burn), &ldquo;Do not know&rdquo; menus, or the Gemini fallback flow into the phone.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {QUICK_SCENARIOS.map((preset) => {
                      const active = activeScenarioId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyQuickScenario(preset)}
                          className={`min-h-[58px] rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-[#1B5E20] bg-[#EBF3EB] text-[#14532D]'
                              : 'border-[#E2E6DF] bg-[#FAFBF9] text-[#182019] hover:bg-[#F0F2ED]'
                          }`}
                        >
                          <p className="text-xs font-semibold leading-snug">{preset.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#5A675C] leading-snug">
                            {preset.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Right Column: Live Interactive Android Phone Screen */}
              <div className="col-span-6 flex justify-center">
                <AndroidPhoneShell framed={true} {...sharedPhoneProps} />
              </div>
            </div>
          )}

          {activeTab === 'crops' && <CropCatalogView />}

          {activeTab === 'cases' && (
            <SavedCasesView
              cases={savedCases}
              networkReport={networkReport}
              onDeleteCase={handleDeleteSavedCase}
              onRetryGeminiForSavedCase={handleRetrySavedCase}
              isCloudLoading={isCloudLoading}
            />
          )}

          {activeTab === 'android' && <AndroidSourceView />}
        </main>
      </div>
    </div>
  );
}
