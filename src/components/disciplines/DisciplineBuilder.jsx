import React, { useState } from 'react';
import {
  Mountain, HardHat, Warehouse, Layers, CircleDashed,
  Star, X, Plus, ChevronDown, ChevronRight,
  Sparkles,
} from 'lucide-react';
import { DISCIPLINE_CONFIG, getDisciplineConfig, getDisciplineSubcategories } from '@/utils/jobDisciplines';

/**
 * DisciplineBuilder — a visual, expandable multi-discipline picker for the
 * Job Wizard. Simplified to three disciplines: Drilling (with CP/Rotary
 * sub-choice), Groundworks (all groundworks crews), and Depot.
 *
 * Props:
 *   disciplines: array of { type, status, drilling_method, required_team_ids, ... }
 *   onChange: (newDisciplines) => void
 *   teams: array of Team records (for per-discipline team assignment)
 */

const DISCIPLINE_ICONS = {
  drilling: Mountain,
  groundworks: HardHat,
  depot: Warehouse,
};

const DISCIPLINE_TONES = {
  drilling:      { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: 'bg-amber-100 text-amber-600',   bar: 'bg-amber-500',   ring: 'ring-amber-300' },
  groundworks:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500', ring: 'ring-emerald-300' },
  depot:         { bg: 'bg-slate-50',   border: 'border-slate-200',  text: 'text-slate-700',   icon: 'bg-slate-100 text-slate-600',   bar: 'bg-slate-400',   ring: 'ring-slate-300' },
};

const STATUSES = [
  { val: 'planning', label: 'Planning' },
  { val: 'active', label: 'Active' },
  { val: 'completed', label: 'Completed' },
  { val: 'on_hold', label: 'On Hold' },
];

const DRILLING_METHODS = [
  { val: 'cp', label: 'CP', desc: 'Cable Percussion' },
  { val: 'rotary', label: 'Rotary', desc: 'Rotary Core' },
  { val: 'window_sampling', label: 'Window Sampling', desc: 'Window Sampler' },
  { val: 'mixed', label: 'Mixed', desc: 'Multiple Methods' },
];

function getTone(type) {
  return DISCIPLINE_TONES[type] || DISCIPLINE_TONES.depot;
}
function getIcon(type) {
  return DISCIPLINE_ICONS[type] || Layers;
}

export default function DisciplineBuilder({ disciplines, onChange, teams = [] }) {
  const items = (Array.isArray(disciplines) ? disciplines : []).map(d => {
    // Map legacy types to new model for display
    const mappedType = d.type === 'enabling' || d.type === 'enabling_works' || d.type === 'supervisor' ? 'groundworks'
      : (d.type === 'coring' || d.type === 'trial_pit') ? 'drilling'
      : d.type;
    return mappedType === d.type ? d : { ...d, type: mappedType };
  });
  const [expanded, setExpanded] = useState({});

  const toggleTeam = (idx, teamId) => {
    const disc = items[idx];
    const current = Array.isArray(disc.required_team_ids) ? disc.required_team_ids : [];
    const next = current.includes(teamId) ? current.filter(id => id !== teamId) : [...current, teamId];
    updateDiscipline(idx, { required_team_ids: next });
  };

  const addDiscipline = (type) => {
    if (items.some(d => d.type === type)) return;
    const newDisc = {
      type,
      status: 'planning',
      drilling_method: type === 'drilling' ? 'cp' : 'not_applicable',
      sub_category: '',
      required_team_ids: [],
    };
    onChange([...items, newDisc]);
    setExpanded({ ...expanded, [type]: true });
  };

  const removeDiscipline = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateDiscipline = (idx, patch) => {
    onChange(items.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const setPrimary = (idx) => {
    if (idx === 0) return;
    const moved = items[idx];
    const rest = items.filter((_, i) => i !== idx);
    onChange([moved, ...rest]);
  };

  const toggleExpand = (type) => {
    setExpanded({ ...expanded, [type]: !expanded[type] });
  };

  const availableTypes = Object.keys(DISCIPLINE_CONFIG).filter(
    (t) => !items.some((d) => d.type === t)
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 leading-none">
              Disciplines
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pick Drilling (CP or Rotary), Groundworks, or Depot — stack multiple tracks if needed
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {items.length} track{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Discipline picker tiles */}
      {availableTypes.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {availableTypes.map((type) => {
            const cfg = getDisciplineConfig(type);
            const Icon = getIcon(type);
            const tone = getTone(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => addDiscipline(type)}
                className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-dashed ${tone.border} ${tone.bg} hover:border-solid hover:shadow-md transition-all`}
              >
                <div className={`w-9 h-9 rounded-lg ${tone.icon} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${tone.text} text-center leading-tight`}>{cfg.label}</span>
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected discipline cards */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((d, i) => {
            const cfg = getDisciplineConfig(d.type);
            const Icon = getIcon(d.type);
            const tone = getTone(d.type);
            const isPrimary = i === 0;
            const isExpanded = expanded[d.type] !== false; // default expanded

            return (
              <div
                key={d.type}
                className={`rounded-xl border-2 overflow-hidden transition-all ${
                  isPrimary ? `${tone.border} ring-1 ${tone.ring}` : 'border-slate-200'
                }`}
              >
                {/* Card header */}
                <div className={`flex items-center gap-3 px-3 py-2.5 ${isPrimary ? tone.bg : 'bg-white'}`}>
                  <div className={`w-9 h-9 rounded-lg ${tone.icon} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
                      {isPrimary && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-current" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {d.status === 'active' ? '🟢 Active track' : d.status === 'completed' ? '✅ Completed' : d.status === 'on_hold' ? '⏸ On hold' : '📋 Planning'}
                      {d.sub_category && (() => {
                        const sub = getDisciplineSubcategories(d.type).find(s => s.val === d.sub_category);
                        return sub ? <span className="ml-1.5">· {sub.label}</span> : null;
                      })()}
                      {d.type === 'drilling' && d.drilling_method && d.drilling_method !== 'not_applicable' && (
                        <span className="ml-1.5">· {d.drilling_method.toUpperCase()}</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimary(i)}
                        title="Make primary discipline"
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(d.type)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDiscipline(i)}
                      title="Remove discipline"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card body — expandable settings */}
                {isExpanded && (
                  <div className="px-3 py-3 space-y-3 bg-white border-t border-slate-100">
                    {/* Status pills */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s.val}
                            type="button"
                            onClick={() => updateDiscipline(i, { status: s.val })}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                              d.status === s.val
                                ? `${tone.bar} text-white border-transparent`
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-category / crew type */}
                    {(() => {
                      const subs = getDisciplineSubcategories(d.type);
                      if (subs.length === 0) return null;
                      return (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Crew Type</label>
                          <div className="flex flex-wrap gap-1.5">
                            {subs.map((s) => (
                              <button
                                key={s.val}
                                type="button"
                                onClick={() => updateDiscipline(i, { sub_category: d.sub_category === s.val ? '' : s.val })}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                                  d.sub_category === s.val
                                    ? `${tone.bar} text-white border-transparent`
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Pick the crew flavour for this track — e.g. a Coring Crew under Groundworks.</p>
                        </div>
                      );
                    })()}

                    {/* Drilling method (only for drilling type) */}
                    {d.type === 'drilling' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Drilling Method</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {DRILLING_METHODS.map((m) => (
                            <button
                              key={m.val}
                              type="button"
                              onClick={() => updateDiscipline(i, { drilling_method: m.val })}
                              className={`px-2 py-1.5 rounded-lg border text-center transition ${
                                d.drilling_method === m.val
                                  ? `${tone.bar} text-white border-transparent`
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span className="block text-xs font-bold">{m.label}</span>
                              <span className="block text-[9px] opacity-70">{m.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl px-4 py-4">
          <Sparkles className="w-5 h-5 text-slate-300 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-500">No disciplines selected yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pick a discipline tile above to start — Drilling, Groundworks, or Depot.
            </p>
          </div>
        </div>
      )}

      {/* Hint */}
      {items.length > 0 && availableTypes.length > 0 && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add another discipline tile above to stack more tracks on this job.
        </p>
      )}
    </div>
  );
}