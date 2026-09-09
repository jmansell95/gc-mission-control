import React from 'react';
import UnderlineTabs from '@/components/hubs/UnderlineTabs';

/**
 * HubTabBar — the hub-level tab switcher.
 * Wraps the canonical UnderlineTabs and adds the responsive sticky
 * behaviour every hub needs: sticks below the mobile header while the
 * body scrolls (phones/tablets), static on desktop.
 * Tabs: [{ id, label, icon, badge, count }]
 */
export default function HubTabBar({ tabs, activeTab, onChange, sticky = true }) {
  if (!tabs || tabs.length === 0) return null;
  return (
    <div className={`${sticky ? 'sticky top-1 lg:static z-20 -mx-1 px-1 bg-background/80 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-0' : ''}`}>
      <UnderlineTabs tabs={tabs} activeId={activeTab} onChange={onChange} variant="main" />
    </div>
  );
}