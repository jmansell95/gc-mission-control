import React, { useState } from 'react';
import {
  LayoutGrid, Briefcase, CalendarClock, Users, Truck, Boxes, Car,
  FlaskConical, ShieldCheck, PoundSterling, FileBarChart, Settings,
  Lock, Eye, ChevronDown, ChevronRight,
} from 'lucide-react';
import { PERMISSION_MODULES, ACCESS_LEVELS } from '@/utils/permissions';
import { hubHasSubTabs } from '@/utils/subTabRegistry';
import SubTabExpansion from './SubTabExpansion';

const ICON_MAP = {
  LayoutGrid, Briefcase, CalendarClock, Users, Truck, Boxes, Car,
  FlaskConical, ShieldCheck, PoundSterling, FileBarChart, Settings,
};

// Cell colours — red for none, amber for read, green for write.
// Matches the PRD's colour-coded matrix requirement.
const LEVEL_COLOURS = {
  write: { active: 'bg-emerald-500 text-white border-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  read: { active: 'bg-amber-500 text-white border-amber-500', dot: 'bg-amber-500', text: 'text-amber-600' },
  none: { active: 'bg-rose-400 text-white border-rose-400', dot: 'bg-rose-400', text: 'text-rose-500' },
};

/**
 * PermissionMatrixGrid — a visual colour-coded matrix for editing permission
 * group access levels. Shows all 12 hubs as rows with 3 toggleable cells
 * per row (None / Read / Write), colour-coded red / amber / green.
 *
 * Replaces the old per-module button-row layout in GroupEditor with a
 * scannable grid that makes the access pattern visible at a glance.
 *
 * Responsive: horizontal scroll on mobile, full grid on desktop.
 */
export default function PermissionMatrixGrid({
  permissions,
  isReadOnly,
  onChange,
  onSetAll,
  subTabPermissions = {},
  onSubTabChange,
  onSetHubSubTabs,
}) {
  const [expandedHub, setExpandedHub] = useState(null);

  const writeCount = Object.values(permissions).filter(v => v === 'write').length;
  const readCount = Object.values(permissions).filter(v => v === 'read').length;
  const noneCount = Object.values(permissions).filter(v => v === 'none').length;
  const total = PERMISSION_MODULES.length;

  return (
    <div className="space-y-3">
      {/* Presets bar + summary */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Presets</span>
        <button onClick={() => onSetAll('write')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Full Access
        </button>
        <button onClick={() => onSetAll('read')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
          <Eye className="w-3 h-3" /> Read All
        </button>
        <button onClick={() => onSetAll('none')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition flex items-center gap-1">
          <Lock className="w-3 h-3" /> Lock All
        </button>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />{writeCount}</span>
          <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" />{readCount}</span>
          <span className="flex items-center gap-1 text-rose-500"><span className="w-2 h-2 rounded-full bg-rose-400" />{noneCount}</span>
          <span className="text-slate-300">/ {total}</span>
        </div>
      </div>

      {/* Matrix grid — responsive with horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[480px]">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_64px_64px_64px_32px] gap-1.5 mb-1.5 px-1">
            <div></div>
            <div className="text-center text-[10px] font-bold text-rose-500 uppercase tracking-wide py-1">None</div>
            <div className="text-center text-[10px] font-bold text-amber-600 uppercase tracking-wide py-1">Read</div>
            <div className="text-center text-[10px] font-bold text-emerald-600 uppercase tracking-wide py-1">Write</div>
            <div></div>
          </div>

          {/* Hub rows */}
          <div className="space-y-1">
            {PERMISSION_MODULES.map(m => {
              const current = permissions[m.key] || 'none';
              const Icon = ICON_MAP[m.icon] || LayoutGrid;
              const effectiveRead = isReadOnly && current === 'write';
              const hasSubs = hubHasSubTabs(m.key);
              const isExpanded = expandedHub === m.key;

              return (
                <div key={m.key}>
                  <div
                    className={`grid grid-cols-[1fr_64px_64px_64px_32px] gap-1.5 items-center p-1.5 rounded-xl transition ${
                      current === 'write' ? 'bg-emerald-50/50' :
                      current === 'read' ? 'bg-amber-50/30' :
                      'bg-rose-50/20'
                    }`}
                  >
                    {/* Hub name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        current === 'write' ? 'bg-emerald-500 text-white' :
                        current === 'read' ? 'bg-amber-100 text-amber-600' :
                        'bg-rose-50 text-rose-400'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-700 truncate">{m.label}</span>
                          {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" title="Sensitive" />}
                        </div>
                      </div>
                    </div>

                    {/* None cell */}
                    <button
                      onClick={() => onChange(m.key, 'none')}
                      className={`h-9 rounded-lg border-2 transition flex items-center justify-center ${
                        current === 'none'
                          ? LEVEL_COLOURS.none.active + ' shadow-sm'
                          : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/50'
                      }`}
                    >
                      {current === 'none' && <Lock className="w-3.5 h-3.5" />}
                    </button>

                    {/* Read cell */}
                    <button
                      onClick={() => onChange(m.key, 'read')}
                      className={`h-9 rounded-lg border-2 transition flex items-center justify-center ${
                        current === 'read'
                          ? LEVEL_COLOURS.read.active + ' shadow-sm'
                          : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      {current === 'read' && <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {/* Write cell */}
                    <button
                      onClick={() => onChange(m.key, 'write')}
                      className={`h-9 rounded-lg border-2 transition flex items-center justify-center ${
                        effectiveRead
                          ? 'bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed'
                          : current === 'write'
                            ? LEVEL_COLOURS.write.active + ' shadow-sm'
                            : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                      title={effectiveRead ? 'Read-Only Lockdown is active' : ''}
                    >
                      {effectiveRead ? <Eye className="w-3.5 h-3.5" /> : current === 'write' && <ShieldCheck className="w-3.5 h-3.5" />}
                    </button>

                    {/* Expand button for hubs with sub-tabs */}
                    <div className="flex items-center justify-center">
                      {hasSubs && current !== 'none' && (
                        <button
                          onClick={() => setExpandedHub(isExpanded ? null : m.key)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                          title="Configure sub-tab access"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-tab expansion */}
                  {isExpanded && hasSubs && current !== 'none' && (
                    <div className="ml-10 mb-1 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <SubTabExpansion
                        hubKey={m.key}
                        subTabPermissions={subTabPermissions}
                        onChange={onSubTabChange}
                        onSetHubAll={(level) => onSetHubSubTabs(m.key, level)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Read-only notice */}
      {isReadOnly && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 font-medium">
            Read-Only Lockdown is active — every hub is forced to view-only access. Full Access cells are overridden to Read.
          </p>
        </div>
      )}

      {/* Default deny notice */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600 font-medium">
          <span className="font-bold">Default Deny</span> — when sub-tab permissions are configured, any sub-tab not explicitly granted is hidden. Click the <ChevronRight className="w-3 h-3 inline -mt-0.5" /> arrow on a hub to configure individual tabs.
        </p>
      </div>
    </div>
  );
}