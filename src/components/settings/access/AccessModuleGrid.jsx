import React from 'react';
import { Lock, Eye, ShieldCheck } from 'lucide-react';
import { PERMISSION_MODULES, ACCESS_LEVELS } from '@/utils/permissions';

// Modules grouped by category for a more organised editor
const MODULE_CATEGORIES = [
  { label: 'Operations', keys: ['overview', 'jobs', 'rota', 'calendar', 'scheduling', 'logistics'] },
  { label: 'People & Compliance', keys: ['staff', 'teams', 'compliance', 'safety', 'timesheets'] },
  { label: 'Financial', keys: ['billing'] },
  { label: 'Assets & Fleet', keys: ['assets'] },
  { label: 'Technical & Audit', keys: ['ags_import', 'log-qc', 'audit-trail'] },
  { label: 'System', keys: ['settings'] },
];

const LEVEL_STYLES = {
  write: { active: 'bg-[#2E5A1A] text-white', icon: ShieldCheck },
  read: { active: 'bg-amber-500 text-white', icon: Eye },
  none: { active: 'bg-slate-200 text-slate-600', icon: Lock },
};

export default function AccessModuleGrid({ permissions, isReadOnly, onChange, onSetAll }) {
  return (
    <div className="space-y-4">
      {/* Quick presets */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Presets:</span>
        <button onClick={() => onSetAll('write')} className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Full Access
        </button>
        <button onClick={() => onSetAll('read')} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
          <Eye className="w-3 h-3" /> Read Everything
        </button>
        <button onClick={() => onSetAll('none')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition flex items-center gap-1">
          <Lock className="w-3 h-3" /> Lock All
        </button>
      </div>

      {/* Module categories */}
      <div className="space-y-3">
        {MODULE_CATEGORIES.map(cat => {
          const catModules = PERMISSION_MODULES.filter(m => cat.keys.includes(m.key));
          if (catModules.length === 0) return null;
          return (
            <div key={cat.label} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cat.label}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {catModules.map(m => {
                  const current = permissions[m.key] || 'none';
                  return (
                    <div key={m.key} className="flex items-center justify-between px-3.5 py-2.5 bg-white">
                      <div className="flex items-center gap-2 min-w-0">
                        {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" title="Sensitive module" />}
                        <span className="text-sm font-medium text-slate-700 truncate">{m.label}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {ACCESS_LEVELS.map(lvl => {
                          const active = current === lvl.value;
                          const effectiveRead = isReadOnly && lvl.value === 'write';
                          const style = LEVEL_STYLES[lvl.value];
                          const Icon = style.icon;
                          return (
                            <button
                              key={lvl.value}
                              onClick={() => onChange(m.key, lvl.value)}
                              className={'px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ' +
                                (active
                                  ? effectiveRead
                                    ? 'bg-amber-100 text-amber-700'
                                    : style.active
                                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}
                            >
                              <Icon className="w-3 h-3" />
                              {effectiveRead && active ? 'Read' : lvl.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}