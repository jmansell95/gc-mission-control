import React from 'react';
import UnderlineTabs from '@/components/hubs/UnderlineTabs';

/**
 * SubTabNav — secondary nav bar for sub-pages within a main hub tab.
 * Now delegates to the shared UnderlineTabs underline-accent style (sub variant).
 *
 * Props: tabs [{ id, label, icon, badge }], activeTab, onChange
 */
export default function SubTabNav({ tabs, activeTab, onChange, className = '' }) {
  if (!tabs || tabs.length <= 1) return null;
  return <UnderlineTabs tabs={tabs} activeId={activeTab} onChange={onChange} variant="sub" className={className} />;
}