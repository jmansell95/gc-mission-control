import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * WidgetErrorState — standardized error state for dashboard widgets.
 * Shows a branded error icon, message, and optional retry button so every
 * widget handles fetch failures the same way instead of silently breaking.
 *
 * Props:
 *   message  — error message (default "Couldn't load this data")
 *   onRetry  — optional retry callback; shows a Retry button when provided
 */
export default function WidgetErrorState({ message = "Couldn't load this data", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center mb-2.5">
        <AlertCircle className="w-5 h-5 text-rose-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2E5A1A] bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}