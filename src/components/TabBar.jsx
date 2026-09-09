import React from 'react';
import UnderlineTabs from '@/components/hubs/UnderlineTabs';

/**
 * TabBar — the canonical hub-level tab switcher.
 * Now delegates to the shared UnderlineTabs underline-accent style.
 * Props: tabs [{ id, label, icon, badge, count }], activeTab, onChange
 */
export default function TabBar({ tabs, activeTab, onChange, className = '' }) {
  return <UnderlineTabs tabs={tabs} activeId={activeTab} onChange={onChange} variant="main" className={className} />;
}