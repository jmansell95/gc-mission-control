import React from 'react';
import UnderlineTabs from '@/components/hubs/UnderlineTabs';

/**
 * PillTabs — secondary tab navigation for sub-pages.
 * Now delegates to the shared UnderlineTabs underline-accent style (sub variant).
 *
 * Props: tabs [{ id, label, icon }], activeId, onChange, contextLabel?
 */
export default function PillTabs({ tabs, activeId, onChange, className = '', contextLabel }) {
  return (
    <div className={`mb-1 ${className}`}>
      {contextLabel && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 text-primary text-ui-caption font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8DC63F]" />
            {contextLabel}
          </span>
        </div>
      )}
      <UnderlineTabs tabs={tabs} activeId={activeId} onChange={onChange} variant="sub" />
    </div>
  );
}