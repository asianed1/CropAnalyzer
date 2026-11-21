import React from 'react';
import { ConditionRecommendation } from '../data/cropsKnowledgeBase';

export interface DiagnosisDisplayData {
  source: 'offline_engine' | 'gemini_cloud';
  transportUsed?: 'wifi' | 'telco' | 'none';
  cropCommonName: string;
  cropScientificName: string;
  diagnosisName: string;
  pathogenScientificName: string;
  category: string;
  probabilityPercent: number;
  summary: string;
  matchReasons?: string[];
  recommendations: ConditionRecommendation;
  payloadKb?: number;
  isVagueMatch?: boolean;
}

interface DiagnosisResultCardProps {
  result: DiagnosisDisplayData;
  alternatives?: {
    cropName: string;
    conditionName: string;
    probabilityPercent: number;
  }[];
  onVerifyOnlineClick?: () => void;
}

export const DiagnosisResultCard: React.FC<DiagnosisResultCardProps> = ({
  result,
  alternatives = [],
  onVerifyOnlineClick,
}) => {
  const isHealthy = result.category.toLowerCase() === 'healthy';
  const isAbiotic = result.category.toLowerCase() === 'abiotic';
  const isBroad = Boolean(result.isVagueMatch || result.category.toLowerCase() === 'broad match');
  const confidenceTier = isBroad
    ? 'Rough Guess (Needs Crop Name)'
    : result.probabilityPercent >= 75
    ? 'Strong Match'
    : result.probabilityPercent >= 58
    ? 'Likely Match'
    : 'Unsure Match';

  return (
    <section
      aria-label="Diagnostic Result"
      className="rounded-2xl border border-[#DCE2D7] bg-white p-5 sm:p-6"
    >
      {/* Quiet unboxed metadata line */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECEFE9] pb-3 text-xs text-[#475449]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#1B5E20]">
            {result.source === 'gemini_cloud'
              ? `Online Second Opinion (${result.transportUsed === 'telco' ? 'Mobile Data' : 'Wi-Fi'})`
              : 'Checked Offline (No Data Used)'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {isBroad ? 'Several Possibilities' : isAbiotic ? 'Water, Sun, Soil, or Fertilizer' : result.category}
          </span>
        </div>
        {onVerifyOnlineClick && result.source === 'offline_engine' && (
          <button
            type="button"
            onClick={onVerifyOnlineClick}
            className="text-xs font-medium text-[#1B5E20] underline underline-offset-4 hover:text-[#14532D] whitespace-nowrap"
          >
            Not sure? Check online for a second opinion
          </button>
        )}
      </div>

      {/* Primary Outputs */}
      <div className="mt-4 grid gap-4 sm:grid-cols-12 sm:items-start">
        <div className="space-y-3 sm:col-span-8">
          <div>
            <p className="text-xs font-medium text-[#5A675C]">Crop</p>
            <h2 className="mt-0.5 text-xl font-bold text-[#182019] text-balance">
              {result.cropCommonName}{' '}
              <span className="font-normal italic text-[#475449]">
                ({result.cropScientificName})
              </span>
            </h2>
          </div>

          <div>
            <p className="text-xs font-medium text-[#5A675C]">
              {isBroad
                ? 'Possible Problems (Pick Crop to Narrow)'
                : isHealthy
                ? 'Plant Status'
                : isAbiotic
                ? 'Water, Sun, Soil, or Fertilizer Cause'
                : 'Likely Problem'}
            </p>
            <p
              className={`mt-0.5 text-lg font-semibold ${
                isHealthy
                  ? 'text-[#1B5E20]'
                  : isAbiotic || isBroad
                  ? 'text-[#B45309]'
                  : 'text-[#9A3412]'
              }`}
            >
              {result.diagnosisName}
            </p>
            <p className="text-sm italic text-[#475449]">{result.pathogenScientificName}</p>
          </div>
        </div>

        <div className="rounded-xl bg-[#F6F7F4] p-4 sm:col-span-4">
          <p className="text-xs font-medium text-[#5A675C]">Match Score</p>
          <p className="mt-1 font-mono-tabular text-3xl font-bold text-[#182019]">
            {result.probabilityPercent}%
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#475449]">{confidenceTier}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[#2C372E]">{result.summary}</p>

      {result.matchReasons && result.matchReasons.length > 0 && (
        <p className="mt-2 text-xs text-[#5A675C]">
          Clues used: {result.matchReasons.join(' · ')}
        </p>
      )}

      {/* Structured Field Recommendations */}
      <div className="mt-6 space-y-4 border-t border-[#ECEFE9] pt-5">
        <h3 className="text-base font-semibold text-[#182019]">How to Fix &amp; Care</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold text-[#1B5E20]">What to Do Today</h4>
            <ul className="mt-1.5 space-y-1.5 text-sm text-[#2C372E]">
              {result.recommendations.immediateActions.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#1B5E20]">
              {isAbiotic ? 'Soil & Water Recovery' : 'Natural / Organic Care'}
            </h4>
            <ul className="mt-1.5 space-y-1.5 text-sm text-[#2C372E]">
              {result.recommendations.biologicalControl.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl bg-[#F6F7F4] p-3.5 text-sm text-[#2C372E]">
          <span className="font-semibold text-[#182019]">Spray &amp; Safety Advice: </span>
          {result.recommendations.chemicalGuidance}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#475449]">How to Prevent Next Time</h4>
          <ul className="mt-1.5 space-y-1 text-sm text-[#475449]">
            {result.recommendations.prevention.map((item, idx) => (
              <li key={idx}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      {alternatives.length > 0 && (
        <div className="mt-5 border-t border-[#ECEFE9] pt-4 text-xs text-[#5A675C]">
          <span className="font-medium text-[#182019]">Other possibilities: </span>
          {alternatives.map((alt, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              {alt.cropName} — {alt.conditionName} (<span className="font-mono-tabular">{alt.probabilityPercent}%</span>)
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
