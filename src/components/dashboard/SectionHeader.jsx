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
        className="w-full flex items-center gap-2.5 px-1 pb-2 border-b-2 border-primary/25 hover:border-primary transition group"
      >
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary" strokeWidth={2.2} />
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <h2 className="text-ui-subheading font-bold tracking-tight leading-tight text-primary uppercase truncate">{title}</h2>
        </div>
        {visibleCount != null && (
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-primary/10 text-primary text-ui-micro font-bold tabular-nums">
            {visibleCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-primary/50 transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}