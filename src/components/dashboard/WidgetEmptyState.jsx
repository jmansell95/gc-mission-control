import React from 'react';

/**
 * Reusable empty-state component for dashboard widgets. Shows an icon,
 * title, and optional message when there's no data to display, instead
 * of leaving blank space.
 */
export default function WidgetEmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
          <Icon className="w-5 h-5 text-slate-300" />
        </div>
      )}
      <p className="text-ui-body font-semibold text-slate-600">{title || 'No data'}</p>
      {message && <p className="text-ui-caption text-slate-400 mt-1 max-w-xs">{message}</p>}
    </div>
  );
}