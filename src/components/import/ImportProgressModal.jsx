import React from 'react';
import { Loader2, CheckCircle2, X } from 'lucide-react';

/**
 * Progress modal for import operations (analyze + apply).
 * Shows a progress bar, current step label, and completion state.
 * Closes automatically after a short delay when complete (optional).
 *
 * Props:
 *   open: boolean — whether the modal is visible
 *   steps: Array<{ label: string }> — ordered steps to display
 *   currentStep: number — 0-based index of the active step
 *   complete: boolean — whether the operation finished successfully
 *   completeTitle: string — title shown when complete
 *   completeMessage: string — message shown when complete
 *   onClose: function — called when the user dismisses the completed modal
 *   error: string | null — error message (shows error state instead of complete)
 */
export default function ImportProgressModal({
  open,
  steps = [],
  currentStep = 0,
  complete = false,
  completeTitle = 'Complete',
  completeMessage = '',
  onClose,
  error = null,
}) {
  if (!open) return null;

  const progress = steps.length > 0
    ? complete ? 100 : Math.round((currentStep / steps.length) * 100)
    : complete ? 100 : 0;
  const hasError = !!error;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            {hasError ? 'Import Failed' : complete ? 'Import Complete' : 'Importing…'}
          </h3>
          {(complete || hasError) && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-slate-600">
              {hasError ? 'Error' : complete ? 'Done' : `${progress}%`}
            </span>
            <span className="text-sm font-bold text-slate-800">{progress}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                hasError ? 'bg-rose-500' : complete ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F]'
              }`}
              style={{ width: `${hasError ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        {hasError ? (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
            <X className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800">An error occurred</p>
              <p className="text-xs text-rose-600 mt-1 break-words">{error}</p>
            </div>
          </div>
        ) : complete ? (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">{completeTitle}</p>
              {completeMessage && <p className="text-xs text-emerald-600 mt-1">{completeMessage}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {steps.map((step, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                    )}
                  </div>
                  <span className={`text-sm ${isDone ? 'text-slate-400 line-through' : isActive ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Close button when complete */}
        {(complete || hasError) && (
          <button
            onClick={onClose}
            className="w-full mt-5 command-gradient text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition hover:shadow-lg"
          >
            {hasError ? 'Close' : 'Done'}
          </button>
        )}
      </div>
    </div>
  );
}