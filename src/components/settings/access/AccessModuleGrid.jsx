import React from 'react';
import {
  LayoutGrid, Briefcase, CalendarClock, Users, Truck, Boxes, Car,
  FlaskConical, ShieldCheck, PoundSterling, FileBarChart, Settings,
  Lock, Eye, ShieldCheck as ShieldIcon, Sparkles,
} from 'lucide-react';
import { PERMISSION_MODULES, ACCESS_LEVELS } from '@/utils/permissions';

const ICON_MAP = {
  LayoutGrid, Briefcase, CalendarClock, Users, Truck, Boxes, Car,
  FlaskConical, ShieldCheck, PoundSterling, FileBarChart, Settings,
};

const LEVEL_STYLES = {
  write: { active: 'bg-[#2E5A1A] text-white border-[#2E5A1A]', icon: ShieldIcon, dot: 'bg-[#2E5A1A]' },
  read: { active: 'bg-amber-500 text-white border-amber-500', icon: Eye, dot: 'bg-amber-500' },
  none: { active: 'bg-slate-200 text-slate-500 border-slate-300', icon: Lock, dot: 'bg-slate-300' },
};

export default function AccessModuleGrid({ permissions, isReadOnly, onChange, onSetAll }) {
  const writeCount = Object.values(permissions).filter(v => v === 'write').length;
  const readCount = Object.values(permissions).filter(v => v === 'read').length;
  const noneCount = Object.values(permissions).filter(v => v === 'none').length;
  const total = PERMISSION_MODULES.length;

  return (
    <div className="space-y-3">
      {/* Presets bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Presets</span>
        <button onClick={() => onSetAll('write')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
          <ShieldIcon className="w-3 h-3" /> Full Access
        </button>
        <button onClick={() => onSetAll('read')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
          <Eye className="w-3 h-3" /> Read All
        </button>
        <button onClick={() => onSetAll('none')} className="text-[11px] font-semibold px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition flex items-center gap-1">
          <Lock className="w-3 h-3" /> Lock All
        </button>
        {/* Summary dots */}
        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-[#2E5A1A]" />{writeCount}</span>
          <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" />{readCount}</span>
          <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300" />{noneCount}</span>
          <span className="text-slate-300">/ {total}</span>
        </div>
      </div>

      {/* Hub card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PERMISSION_MODULES.map(m => {
          const current = permissions[m.key] || 'none';
          const Icon = ICON_MAP[m.icon] || LayoutGrid;
          const effectiveRead = isReadOnly && current === 'write';

          return (
            <div
              key={m.key}
              className={`rounded-xl border transition overflow-hidden ${
                current === 'write' ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/[0.03]' :
                current === 'read' ? 'border-amber-200/60 bg-amber-50/30' :
                'border-slate-200 bg-white'
              }`}
            >
              {/* Hub header */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  current === 'write' ? 'bg-[#2E5A1A] text-white' :
                  current === 'read' ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-700 truncate">{m.label}</span>
                    {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" title="Sensitive" />}
                  </div>
                </div>
              </div>

              {/* Access level buttons */}
              <div className="flex gap-1 px-2.5 pb-2.5">
                {ACCESS_LEVELS.map(lvl => {
                  const active = current === lvl.value;
                  const style = LEVEL_STYLES[lvl.value];
                  const showReadOverride = effectiveRead && lvl.value === 'write';
                  return (
                    <button
                      key={lvl.value}
                      onClick={() => onChange(m.key, lvl.value)}
                      className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                        active
                          ? showReadOverride
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : style.active
                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {showReadOverride ? <Eye className="w-2.5 h-2.5" /> : <style.icon className="w-2.5 h-2.5" />}
                      {showReadOverride ? 'Read' : lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Read-only notice */}
      {isReadOnly && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 font-medium">
            Read-Only Lockdown is active — every hub is forced to view-only access. Full Access buttons are overridden.
          </p>
        </div>
      )}
    </div>
  );
}