import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * SectionHeader — a clean, light header with dark-green text and a green
 * underline that groups dashboard blocks within each rail of the Split
 * Column layout. Collapsible via toggle.
 */
export default function SectionHeader({ title, icon: Icon, accent, collapsed, onToggle, visibleCount }) {
  return (
    <div className="sticky top-0 z-20 mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-1 pb-2 border-b-2 border-[#2E5A1A]/25 hover:border-[#2E5A1A] transition group"
      >
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#2E5A1A]" strokeWidth={2.2} />
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <h2 className="text-sm font-bold tracking-tight leading-tight text-[#2E5A1A] uppercase truncate">{title}</h2>
        </div>
        {visibleCount != null && (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] text-[11px] font-bold tabular-nums">
            {visibleCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#2E5A1A]/50 transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}