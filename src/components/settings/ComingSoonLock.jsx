import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';

/**
 * Locked state shown when a user navigates directly to an integration that
 * has been flagged "Coming Soon" (and is not active). The card explains the
 * integration is not available yet and sends the user back to the overview.
 */
export default function ComingSoonLock({ label, onBack }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="hub-glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{label || 'This integration'} is Coming Soon</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          This integration has been marked as Coming Soon by an admin and can't be opened yet.
          Remove the Coming Soon flag in the Coming Soon Manager to configure it.
        </p>
        <button
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>
      </div>
    </div>
  );
}