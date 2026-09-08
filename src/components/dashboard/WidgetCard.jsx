import React from 'react';
import { WIDGET_REGISTRY } from '@/components/dashboard/registry';

/**
 * WidgetCard — clean, always-expanded wrapper for dashboard widgets.
 * No collapse toggle, no customize mode. Just a header + content.
 */
export default function WidgetCard({ widgetId, children }) {
  const config = WIDGET_REGISTRY[widgetId];
  if (!config) return <div>{children}</div>;

  const Icon = config.icon;
  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm icon-tile-glow">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className="text-ui-subheading font-bold text-slate-800 truncate flex-1">{config.title}</p>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}