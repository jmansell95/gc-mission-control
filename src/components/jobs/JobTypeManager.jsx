import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import {
  X, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Save,
  HardHat, LayoutTemplate, Check, AlertCircle,
} from 'lucide-react';

const COLORS = {
  emerald: { dot: 'bg-emerald-500' },
  amber: { dot: 'bg-amber-500' },
  blue: { dot: 'bg-blue-500' },
  purple: { dot: 'bg-purple-500' },
  slate: { dot: 'bg-slate-500' },
  rose: { dot: 'bg-rose-500' },
  teal: { dot: 'bg-teal-500' },
  orange: { dot: 'bg-orange-500' },
};

const REVENUE_METHODS = [
  { val: 'none', label: 'Markup on Cost' },
  { val: 'meterage_rate', label: 'Meterage Rate' },
  { val: 'day_rate', label: 'Day Rate' },
  { val: 'unit_rate', label: 'Unit Rate' },
  { val: 'flat_fee', label: 'Flat Fee' },
];

const DRILLING_METHODS = [
  { val: 'not_applicable', label: 'N/A' },
  { val: 'cp', label: 'CP' },
  { val: 'rotary', label: 'Rotary' },
  { val: 'mixed', label: 'Mixed' },
];

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'template';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm transition";

/**
 * JobTypeManager — inline panel opened from the job wizard.
 * Lets admins create, edit, delete, and reorder Job Type templates
 * (the "Start from a template" chips), scoped per business stream.
 */
export default function JobTypeManager({ open, onClose, activeDivisionId }) {
  const { divisions, isSuperAdmin } = useDivision();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const { data: jobTypes = [], isLoading } = useQuery({
    queryKey: ['job-types'],
    queryFn: () => base44.entities.JobType.list('-order'),
    enabled: open,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('-name', 200),
    enabled: open,
  });

  if (!open) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['job-types'] });

  const sorted = [...jobTypes].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleReorder = async (id, direction) => {
    const idx = sorted.findIndex(jt => jt.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    try {
      await Promise.all([
        base44.entities.JobType.update(a.id, { order: b.order ?? swapIdx }),
        base44.entities.JobType.update(b.id, { order: a.order ?? idx }),
      ]);
      refresh();
    } catch (e) {
      setError(e.message || 'Could not reorder');
    }
  };

  const handleToggleActive = async (jt) => {
    try {
      await base44.entities.JobType.update(jt.id, { is_active: jt.is_active === false ? true : false });
      refresh();
    } catch (e) {
      setError(e.message || 'Could not update');
    }
  };

  const handleDelete = async (jt) => {
    if (!window.confirm(`Delete the "${jt.label}" template? Jobs already using it keep their type, but it won't appear in the wizard for new jobs.`)) return;
    try {
      await base44.entities.JobType.delete(jt.id);
      refresh();
    } catch (e) {
      setError(e.message || 'Could not delete');
    }
  };

  const handleNew = () => {
    setEditing({
      _isNew: true,
      label: '',
      key: '',
      color: 'slate',
      is_drilling: false,
      order: sorted.length,
      is_active: true,
      division_id: activeDivisionId || '',
      default_revenue_method: 'none',
      default_drilling_method: 'not_applicable',
      default_markup_percentage: '',
      default_budget_amount: '',
      default_duration_days: '',
      default_team_ids: [],
      default_notes: '',
    });
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setEditing(null); onClose(); }} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-t-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#2E5A1A]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <LayoutTemplate className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editing ? (editing._isNew ? 'New Template' : 'Edit Template') : 'Job Type Templates'}
              </h2>
              <p className="text-xs text-slate-400">
                {editing ? 'Set the pre-fill defaults for new jobs' : 'Pre-fill defaults for the job wizard'}
              </p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); onClose(); }} type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && !editing && (
          <div className="mx-5 mt-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {editing ? (
          <JobTypeEditor
            template={editing}
            teams={teams}
            divisions={divisions}
            isSuperAdmin={isSuperAdmin}
            onCancel={() => { setEditing(null); setError(''); }}
            onSaved={() => { setEditing(null); setError(''); refresh(); }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <button type="button" onClick={handleNew} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
              <Plus className="w-4 h-4" /> New Template
            </button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                No templates yet. Create one to pre-fill the job wizard with defaults.
              </div>
            ) : (
              sorted.map((jt, i) => {
                const color = COLORS[jt.color] || COLORS.slate;
                const hasDefaults = jt.default_revenue_method || jt.default_budget_amount || jt.default_duration_days || (jt.default_team_ids && jt.default_team_ids.length > 0) || jt.default_notes;
                const divisionName = jt.division_id ? (divisions.find(d => d.id === jt.division_id)?.name || 'Unknown stream') : 'All streams';
                return (
                  <div key={jt.id} className="hub-glass rounded-xl p-3 flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => handleReorder(jt.id, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-30 transition">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleReorder(jt.id, 1)} disabled={i === sorted.length - 1} className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-30 transition">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm truncate">{jt.label}</p>
                        {jt.is_drilling && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            <HardHat className="w-2.5 h-2.5" /> Drilling
                          </span>
                        )}
                        {hasDefaults && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Defaults
                          </span>
                        )}
                        {jt.is_active === false && (
                          <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">Hidden</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{divisionName} · key: {jt.key}</p>
                    </div>
                    <button type="button" onClick={() => handleToggleActive(jt)} title={jt.is_active === false ? 'Show in wizard' : 'Hide from wizard'} className="p-2 text-slate-400 hover:text-amber-600 transition flex-shrink-0">
                      {jt.is_active === false ? <Plus className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing({ ...jt, _isNew: false })} className="p-2 text-slate-400 hover:text-primary transition flex-shrink-0">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(jt)} className="p-2 text-slate-400 hover:text-red-600 transition flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function JobTypeEditor({ template, teams, divisions, isSuperAdmin, onCancel, onSaved }) {
  const [form, setForm] = useState(template);
  const [keyTouched, setKeyTouched] = useState(!!template.key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'label' && !keyTouched) {
        next.key = slugify(v);
      }
      return next;
    });
    if (k === 'key') setKeyTouched(true);
  };

  const toggleTeam = (id) => {
    setForm(prev => {
      const arr = prev.default_team_ids || [];
      return { ...prev, default_team_ids: arr.includes(id) ? arr.filter(t => t !== id) : [...arr, id] };
    });
  };

  const handleSave = async () => {
    if (!form.label?.trim()) { setError('Label is required'); return; }
    const key = form.key?.trim() || slugify(form.label);
    setSaving(true);
    setError('');
    try {
      const payload = {
        key,
        label: form.label.trim(),
        color: form.color || 'slate',
        is_drilling: !!form.is_drilling,
        order: Number(form.order) || 0,
        is_active: form.is_active !== false,
        division_id: form.division_id || null,
        default_revenue_method: form.default_revenue_method || 'none',
        default_drilling_method: form.default_drilling_method || 'not_applicable',
        default_team_ids: form.default_team_ids || [],
      };
      if (form.default_markup_percentage !== '' && form.default_markup_percentage != null) payload.default_markup_percentage = Number(form.default_markup_percentage);
      if (form.default_budget_amount !== '' && form.default_budget_amount != null) payload.default_budget_amount = Number(form.default_budget_amount);
      if (form.default_duration_days !== '' && form.default_duration_days != null) payload.default_duration_days = Number(form.default_duration_days);
      if (form.default_notes) payload.default_notes = form.default_notes;

      if (form.id) {
        await base44.entities.JobType.update(form.id, payload);
      } else {
        await base44.entities.JobType.create(payload);
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Label & key */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Label <span className="text-red-500">*</span></label>
            <input autoFocus type="text" value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Cable Percussion" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Key <span className="text-xs text-slate-400 font-normal">· stored on jobs</span></label>
            <input type="text" value={form.key} onChange={e => set('key', e.target.value)} placeholder="auto from label" className={`${inputCls} font-mono`} />
          </div>
        </div>

        {/* Colour & drilling */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Colour</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COLORS).map(([name, c]) => (
                <button type="button" key={name} onClick={() => set('color', name)}
                  className={`w-8 h-8 rounded-full ${c.dot} transition ${form.color === name ? 'ring-2 ring-offset-2 ring-slate-400' : 'opacity-70 hover:opacity-100'}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Drilling type?</label>
            <button type="button" onClick={() => set('is_drilling', !form.is_drilling)}
              className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition ${form.is_drilling ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
              <HardHat className="w-4 h-4" />
              {form.is_drilling ? 'Yes — show meterage' : 'No'}
            </button>
          </div>
        </div>

        {/* Division scope */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Stream</label>
          <select value={form.division_id || ''} onChange={e => set('division_id', e.target.value)} className={inputCls}>
            <option value="">All streams (company-wide)</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <p className="text-[11px] text-slate-400 mt-0.5">Scope this template to one stream, or leave it company-wide.</p>
        </div>

        {/* Defaults section */}
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pre-fill Defaults</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing Method</label>
              <select value={form.default_revenue_method || 'none'} onChange={e => set('default_revenue_method', e.target.value)} className={inputCls}>
                {REVENUE_METHODS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Drilling Method</label>
              <select value={form.default_drilling_method || 'not_applicable'} onChange={e => set('default_drilling_method', e.target.value)} className={inputCls}>
                {DRILLING_METHODS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Markup %</label>
              <input type="number" min="0" step="0.1" value={form.default_markup_percentage ?? ''} onChange={e => set('default_markup_percentage', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Budget (£)</label>
              <input type="number" min="0" step="0.01" value={form.default_budget_amount ?? ''} onChange={e => set('default_budget_amount', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duration (days)</label>
              <input type="number" min="0" step="1" value={form.default_duration_days ?? ''} onChange={e => set('default_duration_days', e.target.value)} placeholder="—" className={inputCls} />
            </div>
          </div>

          {/* Teams */}
          {teams.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Required Teams</label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {teams.map(t => {
                  const selected = (form.default_team_ids || []).includes(t.id);
                  return (
                    <button type="button" key={t.id} onClick={() => toggleTeam(t.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition font-medium ${selected ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Notes</label>
            <textarea value={form.default_notes || ''} onChange={e => set('default_notes', e.target.value)} rows="2" placeholder="Standard scope or requirements text…" className={inputCls} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Template</>}
        </button>
      </div>
    </div>
  );
}