import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  TrendingUp, Plus, Trash2, Pencil, X, Loader2, GripVertical, Users,
  Target, PoundSterling, CheckCircle2, AlertCircle, Search,
} from 'lucide-react';
import { KPI_METRICS, KPI_METRIC_MAP, DEPARTMENT_CONFIG } from '@/utils/kpiMetrics';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

export default function PerformanceKpiManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null); // the KPI set being edited (or 'new')
  const [search, setSearch] = useState('');

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ['kpi-sets'],
    queryFn: () => base44.entities.PerformanceKpiSet.list('-sort_order', 100),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['kpi-staff-list'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, '-name', 500),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return sets;
    const q = search.toLowerCase();
    return sets.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.role_key || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }, [sets, search]);

  const handleDelete = async (set) => {
    if (!confirm(`Delete the "${set.name}" KPI set? Staff assigned to it will fall back to the default performance view.`)) return;
    try {
      await base44.entities.PerformanceKpiSet.delete(set.id);
      qc.invalidateQueries({ queryKey: ['kpi-sets'] });
      toast({ title: 'KPI set deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (set) => {
    try {
      await base44.entities.PerformanceKpiSet.update(set.id, { is_active: !set.is_active });
      qc.invalidateQueries({ queryKey: ['kpi-sets'] });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={TrendingUp}
        title="Performance & Incentives"
        description="Create custom KPI sets per role. Each staff member's profile shows only their role's metrics, with a live incentive score calculated from their actual system activity."
        action={
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E5A1A] text-white text-ui-caption font-semibold hover:bg-[#1c4a12] transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> New KPI Set
          </button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search KPI sets by name, role or department..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-ui-body text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 transition"
        />
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-ui-body font-semibold text-slate-600">No KPI sets yet</p>
          <p className="text-ui-caption text-slate-400 mt-1">Create a KPI set for each role — drillers, depot staff, managers — to show role-specific performance on their profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => {
            const dept = DEPARTMENT_CONFIG[s.department] || DEPARTMENT_CONFIG.field;
            const metrics = s.metrics || [];
            const totalBonus = metrics.reduce((sum, m) => sum + (Number(m.bonus_amount) || 0), 0);
            const assignedCount = (s.assigned_staff_ids || []).length;
            return (
              <div key={s.id} className={`hub-glass rounded-2xl p-4 ${!s.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${dept.color}15` }}>
                    <dept.icon className="w-5 h-5" style={{ color: dept.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-ui-subheading font-bold text-slate-900 truncate">{s.name}</h3>
                      <span className="text-ui-micro px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: `${dept.color}15`, color: dept.color }}>{dept.label}</span>
                    </div>
                    <p className="text-ui-caption text-slate-500 truncate">{s.description || s.role_key}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {metrics.map(m => {
                    const metric = KPI_METRIC_MAP[m.key];
                    const MIcon = metric?.icon || Target;
                    return (
                      <span key={m.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-ui-micro font-semibold text-slate-600">
                        <MIcon className="w-3 h-3" /> {m.label}
                        <span className="text-slate-400">×{m.weight}</span>
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-ui-caption">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Users className="w-3 h-3" /> {assignedCount > 0 ? `${assignedCount} assigned` : 'By role'}
                    </span>
                    {totalBonus > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <PoundSterling className="w-3 h-3" /> {totalBonus} max bonus
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggle(s)}
                    className={`relative w-10 h-5 rounded-full transition ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition ${s.is_active ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <KpiSetEditor
          set={editing === 'new' ? null : editing}
          staff={staff}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['kpi-sets'] }); }}
        />
      )}
    </div>
  );
}

function KpiSetEditor({ set, staff, onClose, onSaved }) {
  const { toast } = useToast();
  const isExisting = !!set;
  const [form, setForm] = useState(() => ({
    name: set?.name || '',
    role_key: set?.role_key || '',
    description: set?.description || '',
    department: set?.department || 'field',
    metrics: set?.metrics || [],
    assigned_staff_ids: set?.assigned_staff_ids || [],
    accent_color: set?.accent_color || '#2E5A1A',
    is_active: set?.is_active ?? true,
    sort_order: set?.sort_order || 0,
  }));
  const [saving, setSaving] = useState(false);

  const update = (patch) => setForm(f => ({ ...f, ...patch }));

  const addMetric = (metricKey) => {
    const m = KPI_METRIC_MAP[metricKey];
    if (!m) return;
    if (form.metrics.some(x => x.key === metricKey)) return;
    update({
      metrics: [...form.metrics, {
        key: metricKey,
        label: m.label,
        weight: m.defaultWeight,
        target: m.defaultTarget,
        unit: m.unit,
        incentive_threshold: 80,
        bonus_amount: 0,
      }],
    });
  };

  const updateMetric = (idx, patch) => {
    update({ metrics: form.metrics.map((m, i) => i === idx ? { ...m, ...patch } : m) });
  };

  const removeMetric = (idx) => {
    update({ metrics: form.metrics.filter((_, i) => i !== idx) });
  };

  const toggleStaff = (staffId) => {
    update({
      assigned_staff_ids: form.assigned_staff_ids.includes(staffId)
        ? form.assigned_staff_ids.filter(id => id !== staffId)
        : [...form.assigned_staff_ids, staffId],
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role_key.trim()) {
      toast({ title: 'Name and role key are required', variant: 'destructive' });
      return;
    }
    if (form.metrics.length === 0) {
      toast({ title: 'Add at least one metric', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        role_key: form.role_key.toLowerCase().trim().replace(/\s+/g, '_'),
        name: form.name.trim(),
      };
      if (isExisting) {
        await base44.entities.PerformanceKpiSet.update(set.id, payload);
      } else {
        await base44.entities.PerformanceKpiSet.create(payload);
      }
      toast({ title: isExisting ? 'KPI set updated' : 'KPI set created' });
      onSaved();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const availableMetrics = KPI_METRICS.filter(m => !form.metrics.some(x => x.key === m.key));

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <h3 className="text-ui-heading font-extrabold text-slate-900">{isExisting ? 'Edit KPI Set' : 'New KPI Set'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1">Set Name</label>
              <input value={form.name} onChange={e => update({ name: e.target.value })} placeholder="e.g. Cable Percussion Driller"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-ui-body text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
            </div>
            <div>
              <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1">Role Key</label>
              <input value={form.role_key} onChange={e => update({ role_key: e.target.value })} placeholder="e.g. cp_driller"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-ui-body text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1">Department</label>
              <select value={form.department} onChange={e => update({ department: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-ui-body text-slate-800 focus:outline-none focus:border-[#2E5A1A]">
                {Object.entries(DEPARTMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1">Accent Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color} onChange={e => update({ accent_color: e.target.value })} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input value={form.accent_color} onChange={e => update({ accent_color: e.target.value })} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-ui-body text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1">Description</label>
            <textarea value={form.description} onChange={e => update({ description: e.target.value })} rows={2} placeholder="What this role does and how performance is measured"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-ui-body text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
          </div>

          {/* Metrics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-ui-micro font-bold text-slate-500 uppercase">Metrics ({form.metrics.length})</label>
            </div>
            {form.metrics.length === 0 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <p className="text-ui-caption text-amber-700">Add at least one metric from the catalog below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.metrics.map((m, idx) => {
                  const metric = KPI_METRIC_MAP[m.key];
                  const MIcon = metric?.icon || Target;
                  return (
                    <div key={m.key} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <MIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-ui-body font-semibold text-slate-800 flex-1">{m.label}</span>
                        <button onClick={() => removeMetric(idx)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-ui-micro text-slate-400 block mb-0.5">Weight</label>
                          <input type="number" min="1" max="10" value={m.weight} onChange={e => updateMetric(idx, { weight: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-ui-caption text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
                        </div>
                        <div>
                          <label className="text-ui-micro text-slate-400 block mb-0.5">Target</label>
                          <input type="number" value={m.target} onChange={e => updateMetric(idx, { target: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-ui-caption text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
                        </div>
                        <div>
                          <label className="text-ui-micro text-slate-400 block mb-0.5">Threshold %</label>
                          <input type="number" value={m.incentive_threshold} onChange={e => updateMetric(idx, { incentive_threshold: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-ui-caption text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
                        </div>
                        <div>
                          <label className="text-ui-micro text-slate-400 block mb-0.5">Bonus £</label>
                          <input type="number" value={m.bonus_amount} onChange={e => updateMetric(idx, { bonus_amount: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-ui-caption text-slate-800 focus:outline-none focus:border-[#2E5A1A]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available metrics catalog */}
            {availableMetrics.length > 0 && (
              <div className="mt-2">
                <p className="text-ui-micro text-slate-400 mb-1.5">Add a metric:</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableMetrics.map(m => {
                    const MIcon = m.icon;
                    return (
                      <button key={m.key} onClick={() => addMetric(m.key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-ui-caption font-semibold text-slate-600 hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition">
                        <MIcon className="w-3 h-3" /> {m.label} <Plus className="w-3 h-3" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Staff assignment */}
          <div>
            <label className="text-ui-micro font-bold text-slate-500 uppercase block mb-1.5">
              Assign Staff ({form.assigned_staff_ids.length} selected)
            </label>
            <p className="text-ui-micro text-slate-400 mb-2">Leave empty to auto-match by role key against the staff member's job title.</p>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {staff.map(s => {
                const selected = form.assigned_staff_ids.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleStaff(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${selected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-ui-body text-slate-700 flex-1 truncate">{s.name}</span>
                    <span className="text-ui-micro text-slate-400">{s.job_title || s.worker_type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-ui-caption font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E5A1A] text-white text-ui-caption font-bold shadow-md hover:bg-[#1c4a12] disabled:opacity-60 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isExisting ? 'Save Changes' : 'Create KPI Set'}
          </button>
        </div>
      </div>
    </div>
  );
}