import React from 'react';
import UnderlineTabs from '@/components/hubs/UnderlineTabs';

/**
 * SubPills — secondary tab navigation rendered below a hub's main TabBar.
 * Now delegates to the shared UnderlineTabs underline-accent style (sub variant)
 * so main tabs and sub-tabs share the same visual language.
 *
 * Props: pills [{ id, label, icon?, badge?, count? }], active, onChange
 */
export default function SubPills({ pills = [], active, onChange }) {
  if (!pills || pills.length <= 1) return null;
  return <UnderlineTabs tabs={pills} activeId={active} onChange={onChange} variant="sub" />;
}