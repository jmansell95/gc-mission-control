import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * HubErrorState — consistent, friendly error surface for hubs and widgets.
 * Props: title, description, error (Error|string), onRetry, compact
 */
export default function HubErrorState({ title = 'Something went wrong', description, error, onRetry, compact = false }) {
  const detail = typeof error === 'string' ? error : error?.message;
  return (
    <div className={`hub-glass rounded-3xl text-center animate-slide-up border-rose-100 ${compact ? 'p-5' : 'p-10'}`}>
      <div className={`${compact ? 'w-10 h-10 mb-2' : 'w-14 h-14 mb-4'} rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto`}>
        <AlertTriangle className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
      </div>
      <h3 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-slate-900`}>{title}</h3>
      {(description || detail) && (
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">{description || detail}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}