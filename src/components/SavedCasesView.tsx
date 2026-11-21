import React, { useState } from 'react';
import { Trash2, Wifi } from 'lucide-react';
import { NetworkStatusReport, SavedFieldCase } from '../services/networkAndStorage';

interface SavedCasesViewProps {
  cases: SavedFieldCase[];
  networkReport: NetworkStatusReport;
  onDeleteCase: (caseId: string) => void;
  onRetryGeminiForSavedCase: (entry: SavedFieldCase) => void;
  isCloudLoading: boolean;
}

export const SavedCasesView: React.FC<SavedCasesViewProps> = ({
  cases,
  networkReport,
  onDeleteCase,
  onRetryGeminiForSavedCase,
  isCloudLoading,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(cases[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#182019] text-balance">
            Saved Photos &amp; Checks
          </h1>
          <p className="mt-1 text-sm text-[#475449]">
            Saved right on this phone. Unfinished photos can be checked online later or deleted anytime.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-medium text-[#475449]">
          {cases.length} {cases.length === 1 ? 'photo' : 'photos'} saved
        </span>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-[#DCE2D7] bg-white p-8 text-center">
          <p className="text-base font-medium text-[#182019]">No saved photos yet</p>
          <p className="mt-1 text-sm text-[#5A675C]">
            Check a plant or save a photo for later and it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((entry) => {
            const isOpen = expandedId === entry.id;
            const isUnresolved = entry.source === 'unresolved_saved';
            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-[#DCE2D7] bg-white p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    className="flex flex-1 items-center gap-4 text-left"
                  >
                    <img
                      src={entry.roiImageDataUrl}
                      alt={entry.diagnosisName}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-xl border border-[#E2E6DF] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A675C]">
                        <span className="font-medium text-[#182019]">
                          {entry.source === 'gemini_cloud'
                            ? `Online Check (${entry.transportUsed === 'telco' ? 'Mobile Data' : 'Wi-Fi'})`
                            : entry.source === 'offline_engine'
                            ? 'Checked Offline'
                            : 'Needs Online Check'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        {!isUnresolved && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{entry.probabilityPercent}% match</span>
                          </>
                        )}
                      </div>
                      <h2 className="mt-1 truncate text-base font-bold text-[#182019]">
                        {entry.cropCommonName} — {entry.diagnosisName}
                      </h2>
                      <p className="truncate text-xs italic text-[#475449]">
                        {entry.cropScientificName} · {entry.pathogenScientificName}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {isUnresolved && (
                      <button
                        type="button"
                        disabled={!networkReport.isConnected || isCloudLoading}
                        onClick={() => onRetryGeminiForSavedCase(entry)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#1B5E20] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#14532D] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                      >
                        <Wifi className="h-3.5 w-3.5" />
                        {networkReport.isConnected ? 'Check Online Now' : 'No Signal'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteCase(entry.id)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E2E6DF] px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-red-50 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-[#ECEFE9] pt-4 text-sm text-[#2C372E]">
                    <p>{entry.summary}</p>
                    {entry.recommendations.immediateActions.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-[#1B5E20]">Recommendations:</p>
                        {entry.recommendations.immediateActions.map((act, idx) => (
                          <p key={idx} className="text-xs">
                            • {act}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
