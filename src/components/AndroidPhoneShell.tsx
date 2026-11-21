import React, { useState } from 'react';
import {
  BatteryCharging,
  BookOpen,
  ChevronDown,
  FolderHeart,
  ScanLine,
  Signal,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  ABIOTIC_CONDITIONS_CATALOG,
  CROPS_KNOWLEDGE_BASE,
  FIELD_CONDITION_OPTIONS,
  FarmerContextInput,
  FieldCondition,
  GROWTH_STAGE_OPTIONS,
  GrowthStage,
  PLANT_PART_OPTIONS,
  PlantPart,
  PrimarySymptom,
  RECENT_INPUT_OPTIONS,
  RecentInputHistory,
  SOIL_MOISTURE_OPTIONS,
  SUNLIGHT_OPTIONS,
  SYMPTOM_OPTIONS,
  SoilMoisture,
  SunlightExposure,
} from '../data/cropsKnowledgeBase';
import {
  BoundingBox,
  ImageQualityMetrics,
  LocalAnalysisResult,
} from '../engine/localDiagnosticEngine';
import {
  NetworkStatusReport,
  SavedFieldCase,
} from '../services/networkAndStorage';
import { BoundingBoxViewport } from './BoundingBoxViewport';
import { DiagnosisDisplayData } from './DiagnosisResultCard';
import { CloudPromptStep } from './CloudFallbackModals';

export type PhoneTab = 'scan' | 'crops' | 'cases' | 'android';

interface AndroidPhoneShellProps {
  framed: boolean;
  activeTab: PhoneTab;
  onTabChange: (tab: PhoneTab) => void;
  imageSrc: string;
  activeSampleId?: string;
  box: BoundingBox;
  onBoxChange: (next: BoundingBox) => void;
  onImageSelected: (src: string, sampleId?: string) => void;
  onImageElementReady: (img: HTMLImageElement) => void;
  qualityMetrics: ImageQualityMetrics | null;
  context: FarmerContextInput;
  onContextChange: React.Dispatch<React.SetStateAction<FarmerContextInput>>;
  networkReport: NetworkStatusReport;
  browserOnline: boolean;
  noticeMessage: string | null;
  onDismissNotice: () => void;
  onRunOfflineAnalysis: () => void;
  onVerifyOnlineClick: () => void;
  displayDiagnosis: DiagnosisDisplayData | null;
  localResult: LocalAnalysisResult | null;
  savedCases: SavedFieldCase[];
  onDeleteCase: (caseId: string) => void;
  onRetryGeminiForSavedCase: (entry: SavedFieldCase) => void;
  isCloudLoading: boolean;
  promptStep: CloudPromptStep;
  cloudError: string | null;
  onRespondGemini: (yes: boolean) => void;
  onRespondDelete: (yes: boolean) => void;
}

interface MaterialDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}

const MaterialOutlinedDropdown: React.FC<MaterialDropdownProps> = ({
  label,
  value,
  options,
  onChange,
}) => (
  <label className="relative block pt-1.5">
    <span className="absolute left-3 top-0 z-10 bg-[#FAFBF9] px-1 text-[11px] font-medium text-[#1B5E20]">
      {label}
    </span>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[48px] w-full appearance-none rounded-lg border border-[#798478] bg-[#FAFBF9] pl-3.5 pr-9 text-sm text-[#182019] focus:border-2 focus:border-[#1B5E20] focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475449]" />
    </div>
  </label>
);

export const AndroidPhoneShell: React.FC<AndroidPhoneShellProps> = ({
  framed,
  activeTab,
  onTabChange,
  imageSrc,
  activeSampleId,
  box,
  onBoxChange,
  onImageSelected,
  onImageElementReady,
  qualityMetrics,
  context,
  onContextChange,
  networkReport,
  browserOnline,
  noticeMessage,
  onDismissNotice,
  onRunOfflineAnalysis,
  onVerifyOnlineClick,
  displayDiagnosis,
  localResult,
  savedCases,
  onDeleteCase,
  onRetryGeminiForSavedCase,
  isCloudLoading,
  promptStep,
  cloudError,
  onRespondGemini,
  onRespondDelete,
}) => {
  const [cropSearch, setCropSearch] = useState('');
  const [selectedKbId, setSelectedKbId] = useState<string>('abiotic_causes');
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const transportBadge = !networkReport.isConnected
    ? 'OFFLINE'
    : networkReport.activeTransport === 'telco'
    ? 'MOBILE DATA'
    : 'WIFI';

  const filteredCrops = CROPS_KNOWLEDGE_BASE.filter((c) => {
    const q = cropSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.commonName.toLowerCase().includes(q) ||
      c.scientificName.toLowerCase().includes(q) ||
      c.conditions.some((cond) => cond.name.toLowerCase().includes(q))
    );
  });

  const phoneBody = (
    <div
      className={`relative flex flex-col bg-[#FAFBF9] text-[#182019] ${
        framed ? 'h-[780px] w-full overflow-hidden rounded-[34px]' : 'min-h-screen w-full pb-20'
      }`}
    >
      {/* Android System Status Bar (shown in phone preview frame) */}
      {framed && (
        <div className="flex shrink-0 items-center justify-between bg-[#F2F5EF] px-5 pb-1.5 pt-2.5 text-[11px] font-semibold text-[#182019]">
          <span className="font-mono-tabular">17:06</span>
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full bg-[#161B17] ring-2 ring-[#2C332D]"
          />
          <div className="flex items-center gap-1.5">
            {networkReport.activeTransport === 'wifi' && <Wifi className="h-3.5 w-3.5 text-[#1B5E20]" />}
            {networkReport.activeTransport === 'telco' && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold">
                <Signal className="h-3.5 w-3.5 text-[#9A3412]" />
                5G
              </span>
            )}
            {networkReport.activeTransport === 'none' && (
              <WifiOff className="h-3.5 w-3.5 text-[#7A877B]" />
            )}
            <span className="flex items-center gap-0.5 font-mono-tabular">
              <BatteryCharging className="h-3.5 w-3.5" />
              88%
            </span>
          </div>
        </div>
      )}

      {/* Material 3 TopAppBar */}
      <header
        className={`flex h-14 shrink-0 items-center justify-between border-b border-[#E2E6DF] bg-[#F2F5EF] px-4 ${
          !framed ? 'sticky top-0 z-20' : ''
        }`}
      >
        <span className="font-display text-lg font-bold tracking-tight text-[#14532D] whitespace-nowrap">
          CropAnalyzer
        </span>
        <span className="font-mono-tabular text-[11px] font-semibold text-[#475449] whitespace-nowrap">
          {transportBadge}
        </span>
      </header>

      {/* Scrollable Android Screen Content */}
      <div className="flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5">
        {!browserOnline && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Offline Mode — works with no internet across 30 crops and water, sun, soil &amp; fertilizer checks.
          </div>
        )}

        {noticeMessage && (
          <div className="flex items-center justify-between rounded-xl border border-[#DCE2D7] bg-white px-3 py-2 text-xs text-[#182019]">
            <span className="leading-snug">{noticeMessage}</span>
            <button
              type="button"
              onClick={onDismissNotice}
              className="ml-2 shrink-0 font-semibold text-[#1B5E20]"
            >
              OK
            </button>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Fixed Center Framing Viewport Card */}
            <div className="rounded-2xl border border-[#DCE2D7] bg-white p-3">
              <BoundingBoxViewport
                imageSrc={imageSrc}
                activeSampleId={activeSampleId}
                box={box}
                onBoxChange={onBoxChange}
                onImageSelected={onImageSelected}
                onImageElementReady={onImageElementReady}
                qualityMetrics={qualityMetrics}
                compact
              />
            </div>

            {/* 2 Simple Upfront Questions + Collapsible Optional Details */}
            <div className="space-y-3 rounded-2xl border border-[#DCE2D7] bg-white p-3.5">
              <div>
                <h2 className="text-sm font-bold text-[#182019]">
                  Tell Us What You See (Optional)
                </h2>
                <p className="text-[11px] text-[#5A675C]">
                  Not sure? Leave &ldquo;I do not know&rdquo; and tap Check Plant Now.
                </p>
              </div>

              <MaterialOutlinedDropdown
                label="1. Which crop is this? (30 Crops)"
                value={context.suspectedCropId}
                options={[
                  { value: 'auto', label: 'I do not know — Check all 30 crops' },
                  ...CROPS_KNOWLEDGE_BASE.map((c) => ({
                    value: c.id,
                    label: `${c.commonName} (${c.scientificName})`,
                  })),
                ]}
                onChange={(val) =>
                  onContextChange((prev) => ({ ...prev, suspectedCropId: val }))
                }
              />

              <MaterialOutlinedDropdown
                label="2. What looks wrong?"
                value={context.primarySymptom}
                options={SYMPTOM_OPTIONS}
                onChange={(val) =>
                  onContextChange((prev) => ({
                    ...prev,
                    primarySymptom: val as PrimarySymptom,
                  }))
                }
              />

              <button
                type="button"
                onClick={() => setShowMoreDetails((v) => !v)}
                className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-[#DCE2D7] bg-[#F5F7F3] px-3 py-2 text-left text-xs font-semibold text-[#1B5E20]"
              >
                <span>More Farm Details (Optional)</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`}
                />
              </button>

              {showMoreDetails && (
                <div className="space-y-3 pt-1">
                  <MaterialOutlinedDropdown
                    label="Which part is sick?"
                    value={context.plantPart}
                    options={PLANT_PART_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({ ...prev, plantPart: val as PlantPart }))
                    }
                  />

                  <MaterialOutlinedDropdown
                    label="Plant age"
                    value={context.growthStage}
                    options={GROWTH_STAGE_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({ ...prev, growthStage: val as GrowthStage }))
                    }
                  />

                  <MaterialOutlinedDropdown
                    label="Weather & spread"
                    value={context.fieldCondition}
                    options={FIELD_CONDITION_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({
                        ...prev,
                        fieldCondition: val as FieldCondition,
                      }))
                    }
                  />

                  <MaterialOutlinedDropdown
                    label="Soil wetness"
                    value={context.soilMoisture}
                    options={SOIL_MOISTURE_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({
                        ...prev,
                        soilMoisture: val as SoilMoisture,
                      }))
                    }
                  />

                  <MaterialOutlinedDropdown
                    label="Sunlight"
                    value={context.sunlightExposure}
                    options={SUNLIGHT_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({
                        ...prev,
                        sunlightExposure: val as SunlightExposure,
                      }))
                    }
                  />

                  <MaterialOutlinedDropdown
                    label="Fertilizer or weed spray (2 weeks)"
                    value={context.recentInputs}
                    options={RECENT_INPUT_OPTIONS}
                    onChange={(val) =>
                      onContextChange((prev) => ({
                        ...prev,
                        recentInputs: val as RecentInputHistory,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Material 3 Primary Action Button */}
            <button
              type="button"
              onClick={onRunOfflineAnalysis}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1B5E20] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#14532D] active:scale-[0.99]"
            >
              Check Plant Now
            </button>

            {/* Material 3 Diagnosis Output Card */}
            {displayDiagnosis && (
              <section
                aria-label="Diagnosis Card"
                className="rounded-2xl border border-[#DCE2D7] bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#ECEFE9] pb-2 text-[11px] text-[#475449]">
                  <span className="font-semibold text-[#1B5E20]">
                    {displayDiagnosis.source === 'gemini_cloud'
                      ? `Online Second Opinion (${
                          displayDiagnosis.transportUsed === 'telco' ? 'Mobile Data' : 'Wi-Fi'
                        })`
                      : 'Checked Offline (No Data Used)'}
                  </span>
                  <span className="font-mono-tabular font-bold text-[#182019]">
                    {displayDiagnosis.probabilityPercent}% match
                  </span>
                </div>

                <div>
                  <p className="text-[11px] text-[#5A675C]">Crop</p>
                  <p className="text-base font-bold text-[#182019]">
                    {displayDiagnosis.cropCommonName}{' '}
                    <span className="text-sm font-normal italic text-[#475449]">
                      ({displayDiagnosis.cropScientificName})
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-[#5A675C]">
                    {displayDiagnosis.isVagueMatch || displayDiagnosis.category === 'Broad Match'
                      ? 'Possible Problems (Could Be Several)'
                      : displayDiagnosis.category === 'Abiotic'
                      ? 'Water, Sun, Soil, or Fertilizer Cause'
                      : 'Likely Problem'}
                  </p>
                  <p
                    className={`text-base font-semibold ${
                      displayDiagnosis.category === 'Healthy'
                        ? 'text-[#1B5E20]'
                        : displayDiagnosis.category === 'Abiotic' ||
                          displayDiagnosis.isVagueMatch ||
                          displayDiagnosis.category === 'Broad Match'
                        ? 'text-[#B45309]'
                        : 'text-[#9A3412]'
                    }`}
                  >
                    {displayDiagnosis.diagnosisName}
                  </p>
                  <p className="text-xs italic text-[#475449]">
                    {displayDiagnosis.pathogenScientificName}
                  </p>
                </div>

                <p className="text-xs leading-relaxed text-[#2C372E]">
                  {displayDiagnosis.summary}
                </p>

                <div className="space-y-1.5 border-t border-[#ECEFE9] pt-2.5">
                  <p className="text-xs font-semibold text-[#1B5E20]">What to Do Today</p>
                  {displayDiagnosis.recommendations.immediateActions.map((act, idx) => (
                    <p key={idx} className="text-xs leading-snug text-[#2C372E]">
                      • {act}
                    </p>
                  ))}
                  <p className="pt-1 text-xs font-semibold text-[#182019]">Spray &amp; Safety Advice</p>
                  <p className="text-xs leading-snug text-[#475449]">
                    {displayDiagnosis.recommendations.chemicalGuidance}
                  </p>
                </div>

                {displayDiagnosis.source === 'offline_engine' && (
                  <button
                    type="button"
                    onClick={onVerifyOnlineClick}
                    className="w-full pt-1 text-left text-xs font-semibold text-[#1B5E20] underline underline-offset-4"
                  >
                    Not sure? Check online for a second opinion
                  </button>
                )}

                {displayDiagnosis.source === 'offline_engine' &&
                  (localResult?.alternatives?.length ?? 0) > 0 && (
                    <p className="border-t border-[#ECEFE9] pt-2 text-[11px] text-[#5A675C]">
                      Other possibilities:{' '}
                      {(localResult?.alternatives ?? [])
                        .map((a) => `${a.crop.commonName} — ${a.condition.name} (${a.probabilityPercent}%)`)
                        .join(' · ')}
                    </p>
                  )}
              </section>
            )}
          </div>
        )}

        {activeTab === 'crops' && (
          <div className="space-y-3">
            <input
              type="search"
              value={cropSearch}
              onChange={(e) => setCropSearch(e.target.value)}
              placeholder="Search 30 crops or problems..."
              className="min-h-[44px] w-full rounded-full border border-[#D4DBD0] bg-white px-4 text-sm text-[#182019] focus:border-[#1B5E20] focus:outline-none"
            />

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedKbId('abiotic_causes')}
                className={`min-h-[38px] shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap ${
                  selectedKbId === 'abiotic_causes'
                    ? 'border-[#B45309] bg-amber-50 text-[#78350F]'
                    : 'border-[#DCE2D7] bg-white text-[#475449]'
                }`}
              >
                Water, Sun, Soil &amp; Fertilizer (9)
              </button>
              {filteredCrops.map((crop) => (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => setSelectedKbId(crop.id)}
                  className={`min-h-[38px] shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap ${
                    selectedKbId === crop.id
                      ? 'border-[#1B5E20] bg-[#EBF3EB] text-[#14532D]'
                      : 'border-[#DCE2D7] bg-white text-[#475449]'
                  }`}
                >
                  {crop.commonName}
                </button>
              ))}
            </div>

            {selectedKbId === 'abiotic_causes' ? (
              <div className="space-y-2.5">
                {ABIOTIC_CONDITIONS_CATALOG.map((cond) => (
                  <article
                    key={cond.id}
                    className="rounded-2xl border border-[#DCE2D7] bg-white p-3.5"
                  >
                    <p className="text-xs font-semibold text-[#B45309]">Water, Sun, Soil, or Fertilizer</p>
                    <h3 className="text-sm font-bold text-[#182019]">{cond.name}</h3>
                    <p className="mt-1 text-xs text-[#2C372E]">{cond.summary}</p>
                    <p className="mt-1.5 text-[11px] text-[#475449]">
                      <span className="font-semibold text-[#182019]">What to do: </span>
                      {cond.recommendations.immediateActions[0]}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              (() => {
                const crop =
                  filteredCrops.find((c) => c.id === selectedKbId) ?? filteredCrops[0];
                if (!crop) return null;
                return (
                  <div className="space-y-2.5">
                    <div className="rounded-2xl border border-[#DCE2D7] bg-white p-3.5">
                      <h2 className="text-base font-bold text-[#182019]">
                        {crop.commonName}
                      </h2>
                      <p className="text-xs italic text-[#5A675C]">{crop.scientificName}</p>
                      <p className="mt-1 text-[11px] text-[#475449]">{crop.globalRegions}</p>
                    </div>
                    {crop.conditions.map((cond) => (
                      <article
                        key={cond.id}
                        className="rounded-2xl border border-[#DCE2D7] bg-white p-3.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-[#182019]">{cond.name}</h3>
                          <span className="text-[11px] font-medium text-[#5A675C]">
                            {cond.category}
                          </span>
                        </div>
                        <p className="text-[11px] italic text-[#5A675C]">
                          {cond.scientificName}
                        </p>
                        <p className="mt-1.5 text-xs text-[#2C372E]">{cond.summary}</p>
                      </article>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {activeTab === 'cases' && (
          <div className="space-y-3">
            {savedCases.length === 0 ? (
              <div className="rounded-2xl border border-[#DCE2D7] bg-white p-6 text-center">
                <p className="text-sm font-semibold text-[#182019]">
                  No Saved Photos Yet
                </p>
                <p className="mt-1 text-xs text-[#5A675C]">
                  Plant checks and photos you keep for later will appear here.
                </p>
              </div>
            ) : (
              savedCases.map((entry) => {
                const isUnresolved = entry.source === 'unresolved_saved';
                return (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[#DCE2D7] bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.roiImageDataUrl}
                        alt={entry.diagnosisName}
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-xl border border-[#E2E6DF] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-[#5A675C]">
                          {isUnresolved
                            ? 'Needs online check · Saved on phone'
                            : `${entry.probabilityPercent}% match · ${
                                entry.source === 'gemini_cloud' ? 'Online Check' : 'Offline'
                              }`}
                        </p>
                        <h3 className="truncate text-sm font-bold text-[#182019]">
                          {entry.cropCommonName} — {entry.diagnosisName}
                        </h3>
                        <p className="truncate text-[11px] italic text-[#475449]">
                          {entry.pathogenScientificName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnresolved && (
                        <button
                          type="button"
                          disabled={!networkReport.isConnected || isCloudLoading}
                          onClick={() => onRetryGeminiForSavedCase(entry)}
                          className="min-h-[40px] flex-1 rounded-full bg-[#1B5E20] px-3 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {networkReport.isConnected ? 'Check Online Now' : 'No Signal'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteCase(entry.id)}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full border border-[#E2E6DF] px-3.5 text-xs font-medium text-[#991B1B]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'android' && (
          <div className="space-y-3 rounded-2xl border border-[#DCE2D7] bg-white p-4">
            <h2 className="text-base font-bold text-[#182019]">
              Android App Source (APK Project)
            </h2>
            <p className="text-xs leading-relaxed text-[#475449]">
              Ready-to-build Android app with live camera, photo gallery picker, 30 crops + 9 water/sun/soil/fertilizer guides, offline phone memory, and Wi-Fi-first online check.
            </p>
            <a
              href="/api/android-project.zip"
              download="CropAnalyzer-Android.zip"
              className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#1B5E20] px-4 text-xs font-semibold text-white"
            >
              Download CropAnalyzer-Android.zip
            </a>
          </div>
        )}
      </div>

      {/* Material 3 Bottom NavigationBar */}
      <nav
        aria-label="Android Bottom Navigation"
        className={`shrink-0 border-t border-[#DCE2D7] bg-[#EEF2EC] px-2 pt-1.5 pb-1 ${
          !framed ? 'fixed bottom-0 left-0 right-0 z-30 pb-safe' : ''
        }`}
      >
        <div className="grid grid-cols-4 items-center">
          {(
            [
              ['scan', 'Check', ScanLine],
              ['crops', '30 Crops', BookOpen],
              ['cases', `Saved (${savedCases.length})`, FolderHeart],
              ['android', 'APK', Smartphone],
            ] as [PhoneTab, string, React.ComponentType<{ className?: string }>][]
          ).map(([id, label, Icon]) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 py-1"
              >
                <span
                  className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-[#C8E6C9] text-[#14532D]' : 'text-[#475449]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    active ? 'font-bold text-[#14532D]' : 'text-[#475449]'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        {framed && (
          <div className="mt-1 flex justify-center pb-1">
            <span className="h-1 w-28 rounded-full bg-[#475449]/40" />
          </div>
        )}
      </nav>

      {/* Material 3 AlertDialog Overlay scoped inside Android Phone Frame */}
      {promptStep.type !== 'none' && (
        <div
          role="dialog"
          aria-modal="true"
          className={`${
            framed ? 'absolute inset-0 z-40' : 'fixed inset-0 z-50'
          } flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]`}
        >
          {promptStep.type === 'ask_gemini_yn' ? (
            <div className="w-full max-w-[330px] rounded-[28px] bg-[#FAFBF9] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-[#182019]">
                Not Sure Offline — Check Online Now?
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-[#475449]">
                {promptStep.reason}
              </p>
              <div className="mt-3 rounded-2xl bg-[#EEF2EC] p-3 text-xs text-[#182019]">
                <p className="font-semibold">
                  {networkReport.activeTransport === 'telco'
                    ? 'Using Mobile Data (Wi-Fi unavailable)'
                    : 'Using Free Wi-Fi First'}
                </p>
                <p className="mt-0.5 text-[#475449]">
                  Only sends the small leaf photo inside the green box.
                </p>
              </div>
              {cloudError && (
                <p className="mt-2.5 rounded-xl bg-red-50 p-2.5 text-xs text-red-900">
                  {cloudError}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isCloudLoading}
                  onClick={() => onRespondGemini(true)}
                  className="min-h-[44px] w-full rounded-full bg-[#1B5E20] px-4 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isCloudLoading ? 'Checking Online...' : 'Yes, Check Online'}
                </button>
                <button
                  type="button"
                  disabled={isCloudLoading}
                  onClick={() => onRespondGemini(false)}
                  className="min-h-[44px] w-full rounded-full px-4 text-xs font-semibold text-[#1B5E20] hover:bg-[#EBF3EB]"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[330px] rounded-[28px] bg-[#FAFBF9] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-[#182019]">
                Delete Unfinished Photo?
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-[#475449]">
                {promptStep.reason} Do you want to delete this photo from your phone, or keep it saved to check later?
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onRespondDelete(true)}
                  className="min-h-[44px] w-full rounded-full bg-[#991B1B] px-4 text-xs font-semibold text-white"
                >
                  Yes, Delete Photo
                </button>
                <button
                  type="button"
                  onClick={() => onRespondDelete(false)}
                  className="min-h-[44px] w-full rounded-full px-4 text-xs font-semibold text-[#1B5E20] hover:bg-[#EBF3EB]"
                >
                  No, Keep Saved
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!framed) {
    return phoneBody;
  }

  return (
    <div className="mx-auto w-full max-w-[404px] rounded-[44px] border-[7px] border-[#1F2420] bg-[#1F2420] p-1.5 shadow-2xl">
      {phoneBody}
    </div>
  );
};
