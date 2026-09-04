import React from 'react';

/**
 * HubEmptyState — consistent, polished empty state for all hub pages.
 * Shows an icon, title, description, and optional action button.
 *
 * Props:
 *   icon     — lucide icon component
 *   title    — short heading
 *   description — helper text
 *   action   — optional { label, onClick } for a CTA button
 */
export default function HubEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="insight-card rounded-2xl p-10 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        {Icon && <Icon className="w-7 h-7 text-slate-400" />}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#244715] transition shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}