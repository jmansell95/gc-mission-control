import React from 'react';
import { ArrowUpRight, Zap } from 'lucide-react';

/**
 * WidgetActionFooter — shared two-button footer for bento widgets.
 * Deep-link button (secondary style: white/slate border) + quick-action
 * button (primary brand style: dark-green). Both stop propagation so
 * they don't trigger the widget's card-level click handler.
 */
export default function WidgetActionFooter({ deepLinkLabel, onDeepLink, quickActionLabel, onQuickAction }) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDeepLink?.(); }}
        className="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-ui-caption font-bold hover:bg-slate-50 active:scale-[0.98] transition"
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
        {deepLinkLabel}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onQuickAction?.(); }}
        className="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 bg-[#2E5A1A] text-white rounded-xl text-ui-caption font-bold hover:bg-[#244715] active:scale-[0.98] transition"
      >
        <Zap className="w-3.5 h-3.5" />
        {quickActionLabel}
      </button>
    </div>
  );
}