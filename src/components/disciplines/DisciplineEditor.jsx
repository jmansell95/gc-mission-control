import React from 'react';
import { Plus, X, GripVertical, Star } from 'lucide-react';
import { DISCIPLINE_CONFIG, getDisciplineConfig, getJobDisciplines } from '@/utils/jobDisciplines';

/**
 * DisciplineEditor — multi-discipline picker for the Job Wizard.
 * Lets the user stack multiple discipline tracks on a job. The first
 * selected discipline is the primary (drives dashboard color-coding and
 * legacy field mirroring). Each track gets default status/dates/revenue
 * method inherited from the job-level fields.
 *
 * Props:
 *   disciplines: array of discipline objects { type, status, ... }
 *   onChange: (newDisciplines) => void
 */
const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-xs transition";

const ALL_DISCIPLINE_TYPES = Object.keys(DISCIPLINE_CONFIG);

export default function DisciplineEditor({ disciplines, onChange }) {
  const items = Array.isArray(disciplines) ? disciplines : [];

  const addDiscipline = (type) => {
    if (items.some(d => d.type === type)) return;
    onChange([...items, { type, status: 'planning' }]);
  };

  const removeDiscipline = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx) => {
    if (idx === 0) return;
    const moved = items[idx];
    const rest = items.filter((_, i) => i !== idx);
    onChange([moved, ...rest]);
  };

  const availableTypes = ALL_DISCIPLINE_TYPES.filter(t => !items.some(d => d.type === t));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          Disciplines <span className="text-xs text-slate-400 font-normal">· stack multiple tracks on one job</span>
        </label>
        {items.length > 0 && (
          <span className="text-[11px] text-slate-400">{items.length} track{items.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Selected disciplines — ordered, first = primary */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((d, i) => {
            const cfg = getDisciplineConfig(d.type);
            const isPrimary = i === 0;
            return (
              <div key={d.type} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isPrimary ? 'border-primary/30 bg-primary/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-sm font-semibold text-slate-800 truncate">{cfg.label}</span>
                  {isPrimary && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5" /> Primary
                    </span>
                  )}
                </div>
                {!isPrimary && (
                  <button type="button" onClick={() => setPrimary(i)} title="Make primary"
                    className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => removeDiscipline(i)} title="Remove"
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add discipline dropdown */}
      {availableTypes.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value=""
              onChange={(e) => { if (e.target.value) addDiscipline(e.target.value); e.target.value = ''; }}
              className={`${inputCls} pr-8 appearance-none cursor-pointer`}
            >
              <option value="">+ Add a discipline…</option>
              {availableTypes.map(t => {
                const cfg = getDisciplineConfig(t);
                return <option key={t} value={t}>{cfg.label}</option>;
              })}
            </select>
            <Plus className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-[11px] text-slate-400">No disciplines selected — the job will default to a single track from the Job Type field.</p>
      )}
    </div>
  );
}