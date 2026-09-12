import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Eye, ShieldCheck } from 'lucide-react';
import { SUB_TAB_REGISTRY, getHubTabs, getTabSubTabs } from '@/utils/subTabRegistry';

const LEVEL_STYLES = {
  write: { active: 'bg-primary text-white border-primary', icon: ShieldCheck },
  read: { active: 'bg-amber-500 text-white border-amber-500', icon: Eye },
  none: { active: 'bg-slate-200 text-slate-500 border-slate-300', icon: Lock },
};

const LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
];

function LevelToggle({ current, onChange, size = 'sm' }) {
  return (
    <div className={`flex gap-1 ${size === 'sm' ? '' : ''}`}>
      {LEVELS.map(lvl => {
        const active = current === lvl.value;
        const style = LEVEL_STYLES[lvl.value];
        return (
          <button
            key={lvl.value}
            onClick={() => onChange(lvl.value)}
            className={`flex items-center justify-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
              active ? style.active : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <style.icon className="w-2.5 h-2.5" />
            {lvl.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * SubTabExpansion — the drill-down sub-tab permission editor for a single hub.
 * Renders the hub's tabs as collapsible rows, each with a 3-state toggle.
 * Tabs that have sub-tabs show their own expand/collapse for sub-tab rows.
 *
 * Props:
 *   hubKey           — the hub module key (e.g. 'billing', 'compliance')
 *   subTabPermissions — the flat sub_tab_permissions map
 *   onChange         — (permKey, level) => void
 *   onSetHubAll      — (level) => void  (set all sub-tabs for this hub)
 */
export default function SubTabExpansion({ hubKey, subTabPermissions = {}, onChange, onSetHubAll }) {
  const [expandedTabs, setExpandedTabs] = useState({});
  const tabs = getHubTabs(hubKey);

  const toggleTab = (tabKey) => setExpandedTabs(s => ({ ...s, [tabKey]: !s[tabKey] }));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
      {/* Hub-level preset bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub-Tab Access</span>
        <div className="ml-auto flex gap-1">
          <button onClick={() => onSetHubAll('write')} className="text-[10px] font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition">
            Grant All
          </button>
          <button onClick={() => onSetHubAll('read')} className="text-[10px] font-semibold px-2 py-1 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 transition">
            Read All
          </button>
          <button onClick={() => onSetHubAll('none')} className="text-[10px] font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition">
            Lock All
          </button>
        </div>
      </div>

      {/* Tab rows */}
      <div className="divide-y divide-slate-100">
        {tabs.map(tab => {
          const tabPermKey = `${hubKey}.${tab.key}`;
          const current = subTabPermissions[tabPermKey] || 'none';
          const subTabs = getTabSubTabs(hubKey, tab.key);
          const isExpanded = expandedTabs[tab.key];

          return (
            <div key={tab.key}>
              {/* Tab row */}
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/60 transition">
                {subTabs.length > 0 ? (
                  <button
                    onClick={() => toggleTab(tab.key)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <span className="w-4.5 flex-shrink-0" />
                )}
                <span className="text-xs font-semibold text-slate-600 flex-1 truncate">{tab.label}</span>
                <LevelToggle current={current} onChange={(level) => onChange(tabPermKey, level)} />
              </div>

              {/* Sub-tab rows */}
              {isExpanded && subTabs.length > 0 && (
                <div className="bg-slate-100/40">
                  {subTabs.map(sub => {
                    const subPermKey = `${hubKey}.${tab.key}.${sub.key}`;
                    const subCurrent = subTabPermissions[subPermKey] || 'none';
                    return (
                      <div key={sub.key} className="flex items-center gap-2 px-3 py-1.5 pl-9 hover:bg-white/60 transition">
                        <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                        <span className="text-[11px] font-medium text-slate-500 flex-1 truncate">{sub.label}</span>
                        <LevelToggle current={subCurrent} onChange={(level) => onChange(subPermKey, level)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}