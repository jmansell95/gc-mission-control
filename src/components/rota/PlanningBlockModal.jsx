import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Trash2, Rocket, Calendar, MapPin, Cog, Users, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

/**
 * PlanningBlockModal — interactive modal for creating and editing tentative
 * planning blocks on the Resource Planner. Supports:
 *  - Date range, rig type (CP/Rotary/Mixed/N/A), tentative rig, tentative crew
 *  - Crew multi-select filtered by rig-type qualification (has_cp / has_rotary)
 *  - Live preview strip showing where the block sits
 *  - Promote to real Job (creates Job + RotaAssignments via backend function)
 *  - Delete block
 */
export default function PlanningBlockModal({ open, onClose, block, rigs, staff, divisionId, defaultDates, onSaved }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    rig_type: 'not_applicable',
    rig_asset_id: '',
    tentative_crew_ids: [],
    location: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    if (block) {
      setForm({
        name: block.name || '',
        start_date: block.start_date || '',
        end_date: block.end_date || '',
        rig_type: block.rig_type || 'not_applicable',
        rig_asset_id: block.rig_asset_id || '',
        tentative_crew_ids: block.tentative_crew_ids || [],
        location: block.location || '',
        notes: block.notes || '',
      });
    } else {
      setForm({
        name: '',
        start_date: defaultDates?.start || '',
        end_date: defaultDates?.end || defaultDates?.start || '',
        rig_type: 'not_applicable',
        rig_asset_id: '',
        tentative_crew_ids: [],
        location: '',
        notes: '',
      });
    }
  }, [block, defaultDates, open]);

  // Filter staff by rig type qualification
  const eligibleStaff = useMemo(() => {
    if (!staff) return [];
    if (form.rig_type === 'cp') return staff.filter(s => s.has_cp);
    if (form.rig_type === 'rotary') return staff.filter(s => s.has_rotary);
    if (form.rig_type === 'mixed') return staff.filter(s => s.has_cp || s.has_rotary);
    return staff;
  }, [staff, form.rig_type]);

  const toggleCrew = (sid) => {
    setForm(f => ({
      ...f,
      tentative_crew_ids: f.tentative_crew_ids.includes(sid)
        ? f.tentative_crew_ids.filter(id => id !== sid)
        : [...f.tentative_crew_ids, sid],
    }));
  };

  const handleSave = async () => {
    if (!form.start_date || !form.end_date) {
      toast({ title: 'Dates required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (block) {
        await base44.entities.PlanningBlock.update(block.id, form);
        toast({ title: 'Planning block updated' });
      } else {
        await base44.functions.invoke('createPlanningBlock', {
          data: { ...form, division_id: divisionId },
        });
        toast({ title: 'Planning block created', description: 'Managers notified for review' });
      }
      queryClient.invalidateQueries({ queryKey: ['availability-matrix'] });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    setPromoting(true);
    try {
      const res = await base44.functions.invoke('promotePlanningBlock', { block_id: block.id });
      toast({ title: 'Promoted to job', description: 'Job created with rota assignments' });
      queryClient.invalidateQueries({ queryKey: ['availability-matrix'] });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Promote failed', description: e.message, variant: 'destructive' });
    } finally {
      setPromoting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.PlanningBlock.delete(block.id);
      toast({ title: 'Planning block deleted' });
      queryClient.invalidateQueries({ queryKey: ['availability-matrix'] });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  const dateRange = form.start_date && form.end_date
    ? `${form.start_date}${form.end_date !== form.start_date ? ' → ' + form.end_date : ''}`
    : 'Select dates';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto my-auto hub-glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{block ? 'Edit Planning Block' : 'New Planning Block'}</h3>
              <p className="text-xs text-slate-500">{dateRange}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[calc(100dvh-180px)] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Block / Job Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cambridge North — Potential CP Drilling"
              className="w-full mt-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full mt-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full mt-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>

          {/* Rig type */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Rig Type</label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {[
                { key: 'cp', label: 'CP' },
                { key: 'rotary', label: 'Rotary' },
                { key: 'mixed', label: 'Mixed' },
                { key: 'not_applicable', label: 'N/A' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setForm(f => ({ ...f, rig_type: opt.key }))}
                  className={`h-9 rounded-xl text-xs font-bold transition ${form.rig_type === opt.key
                    ? 'command-gradient text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rig picker */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Cog className="w-3 h-3" /> Tentative Rig
            </label>
            <select value={form.rig_asset_id} onChange={e => setForm(f => ({ ...f, rig_asset_id: e.target.value }))}
              className="w-full mt-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition">
              <option value="">No rig assigned</option>
              {rigs.map(r => <option key={r.id} value={r.id}>{r.name}{r.rig_type ? ` (${r.rig_type.toUpperCase()})` : ''}</option>)}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location
            </label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Site address or area"
              className="w-full mt-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition" />
          </div>

          {/* Tentative crew */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Users className="w-3 h-3" /> Tentative Crew
              {form.rig_type !== 'not_applicable' && form.rig_type !== 'mixed' && (
                <span className="text-[10px] text-amber-600 font-medium ml-1">— filtered by {form.rig_type.toUpperCase()} qualification</span>
              )}
            </label>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 space-y-0.5">
              {eligibleStaff.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No staff match the selected rig type.</p>
              ) : eligibleStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={form.tentative_crew_ids.includes(s.id)}
                    onChange={() => toggleCrew(s.id)}
                    className="w-4 h-4 rounded accent-amber-500" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{s.name}</span>
                  {s.has_cp && <span className="text-[8px] font-bold px-1 rounded bg-blue-100 text-blue-700">CP</span>}
                  {s.has_rotary && <span className="text-[8px] font-bold px-1 rounded bg-orange-100 text-orange-700">Rot</span>}
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {s.worker_type === 'direct_employee' ? 'Direct' : s.worker_type === 'subcontractor' ? 'Sub' : 'Agency'}
                  </span>
                </label>
              ))}
            </div>
            {form.tentative_crew_ids.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">{form.tentative_crew_ids.length} crew selected</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notes
            </label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Planning notes, client details, potential scope..."
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 transition resize-none" />
          </div>

          {/* Live preview */}
          {form.start_date && form.end_date && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Preview on timeline</p>
              <div className="bg-planning rounded h-7 flex items-center px-2.5">
                <span className="text-[10px] font-bold text-amber-800 truncate">
                  {form.name || 'Tentative'} · {dateRange}
                  {form.rig_type !== 'not_applicable' && ` · ${form.rig_type.toUpperCase()}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          {block && (
            <>
              <button onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition disabled:opacity-50">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
              </button>
              <button onClick={handlePromote} disabled={promoting || block.status === 'promoted'}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                {promoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                {block.status === 'promoted' ? 'Promoted' : 'Promote to Job'}
              </button>
              <div className="flex-1" />
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
              </button>
            </>
          )}
          {!block && (
            <>
              <div className="flex-1" />
              <button onClick={onClose}
                className="h-9 px-4 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Create Block
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}