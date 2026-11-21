import React from 'react';
import { Loader2, Trash2, Wifi } from 'lucide-react';
import { NetworkStatusReport } from '../services/networkAndStorage';

export type CloudPromptStep =
  | { type: 'none' }
  | {
      type: 'ask_gemini_yn';
      reason: string;
      payloadKb: number;
    }
  | {
      type: 'ask_delete_memory_yn';
      reason: string;
    };

interface CloudFallbackModalsProps {
  step: CloudPromptStep;
  networkReport: NetworkStatusReport;
  isCloudLoading: boolean;
  cloudError: string | null;
  onRespondGemini: (proceedYes: boolean) => void;
  onRespondDelete: (deleteYes: boolean) => void;
}

export const CloudFallbackModals: React.FC<CloudFallbackModalsProps> = ({
  step,
  networkReport,
  isCloudLoading,
  cloudError,
  onRespondGemini,
  onRespondDelete,
}) => {
  if (step.type === 'none' && !isCloudLoading) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#DCE2D7] bg-white p-6 shadow-xl">
        {isCloudLoading ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
            <h2 className="mt-4 text-lg font-bold text-[#182019]">
              Checking Online for a Second Opinion
            </h2>
            <p className="mt-1 text-sm text-[#475449]">
              Sending only the small leaf photo over{' '}
              <span className="font-semibold">
                {networkReport.activeTransport === 'telco' ? 'Mobile Data' : 'Wi-Fi (Priority 1)'}
              </span>
              ...
            </p>
          </div>
        ) : step.type === 'ask_gemini_yn' ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1B5E20]">
              <Wifi className="h-4 w-4" />
              <span>{networkReport.priorityLabel}</span>
            </div>

            <h2 className="mt-2 text-lg font-bold text-[#182019] text-balance">
              Not Sure Offline — Check Online Now?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[#475449]">
              {step.reason}
            </p>

            <p className="mt-3 rounded-xl bg-[#F6F7F4] p-3 text-xs text-[#2C372E]">
              Internet signal is ready (<span className="font-semibold">{networkReport.activeTransport === 'wifi' ? 'Wi-Fi First' : 'Mobile Data'}</span>). Only the small cropped leaf photo inside the green box and your menu choices are sent.
            </p>

            {cloudError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
                {cloudError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onRespondGemini(false)}
                className="min-h-[44px] rounded-xl border border-[#D4DBD0] bg-white px-4 py-2 text-sm font-medium text-[#182019] hover:bg-[#F3F5F0]"
              >
                No, Stay Offline
              </button>
              <button
                type="button"
                onClick={() => onRespondGemini(true)}
                className="min-h-[44px] rounded-xl bg-[#1B5E20] px-5 py-2 text-sm font-semibold text-white hover:bg-[#14532D]"
              >
                Yes, Check Online
              </button>
            </div>
          </div>
        ) : step.type === 'ask_delete_memory_yn' ? (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9A3412]">
              <Trash2 className="h-4 w-4" />
              <span>Unfinished Photo Check</span>
            </div>

            <h2 className="mt-2 text-lg font-bold text-[#182019] text-balance">
              Delete Unfinished Photo?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[#475449]">
              {step.reason} Nothing was sent online. Do you want to delete this photo from your phone, or keep it saved to check later?
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onRespondDelete(false)}
                className="min-h-[44px] rounded-xl border border-[#D4DBD0] bg-white px-4 py-2 text-sm font-medium text-[#182019] hover:bg-[#F3F5F0]"
              >
                No, Keep Saved
              </button>
              <button
                type="button"
                onClick={() => onRespondDelete(true)}
                className="min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#991B1B]"
              >
                Yes, Delete Photo
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
