import React from 'react';
import TabBar from '@/components/TabBar';

/**
 * HubTabBar — the hub-level tab switcher. Wraps the canonical TabBar and adds
 * the responsive behaviour every hub needs:
 *   • sticks below the mobile header while the body scrolls (phones/tablets)
 *   • static, breathable placement on desktop
 * Tabs: [{ id, label, icon, badge, count }]
 */
export default function HubTabBar({ tabs, activeTab, onChange, sticky = true }) {
  if (!tabs || tabs.length === 0) return null;
  return (
    <div className={`${sticky ? 'sticky top-1 lg:static z-20' : ''} -mx-1 px-1 py-1 rounded-[1.25rem] bg-background/80 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-0`}>
      <TabBar tabs={tabs} activeTab={activeTab} onChange={onChange} />
    </div>
  );
}