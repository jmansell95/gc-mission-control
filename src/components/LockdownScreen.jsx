import React from 'react';
import { Lock } from 'lucide-react';

/**
 * LockdownScreen — shown when a user has no access to a hub or
 * when all their sub-tabs on a hub are set to 'none' (default deny).
 * Displays a clear, non-technical message directing the user to
 * contact their administrator.
 */
export default function LockdownScreen({ title, message }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="hub-glass rounded-3xl p-8 sm:p-12 text-center max-w-md animate-slide-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/15 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-[#2E5A1A]" />
        </div>
        <h2 className="text-ui-subheading font-bold text-slate-900 mb-2">
          {title || 'You do not have access to this area'}
        </h2>
        <p className="text-ui-body text-slate-500 leading-relaxed">
          {message || 'Please contact your administrator to get your permissions set up.'}
        </p>
      </div>
    </div>
  );
}