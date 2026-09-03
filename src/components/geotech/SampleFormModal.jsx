import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SAMPLE_TYPES = [
  { value: 'disturbed', label: 'Disturbed (Bag)' },
  { value: 'undisturbed_u100', label: 'U100 Tube' },
  { value: 'undisturbed_ut100', label: 'UT100 Tube' },
  { value: 'spt_split_spoon', label: 'SPT Split Spoon' },
  { value: 'rotary_core', label: 'Rotary Core' },
  { value: 'window_sample', label: 'Window Sample' },
  { value: 'bulk_sample', label: 'Bulk Sample' },
  { value: 'water_sample', label: 'Water Sample' },
  { value: 'gas_sample', label: 'Gas Sample' },
  { value: 'hand_excavated', label: 'Hand Excavated' },
];

const TEST_OPTIONS = [
  'sieve_analysis', 'atterberg_limits', 'moisture_content', 'bulk_density',
  'particle_density', 'triaxial_test', 'oedometer_test', 'cbr_test',
  'unconfined_compressive_strength', 'point_load_test', 'shear_box',
  'chemical_contamination', 'organic_content', 'sulphate_content',
  'ph_value', 'petrographic_analysis', 'asbestos_screening',
  'groundwater_chemistry', 'gas_analysis', 'other',
];

const inputClass = 'w-full px-3 py-2 bg-[#0B1A0B] border border-[#2a3a2a] rounded-lg text-sm text-[#E0E0E0] placeholder-[#5a6a5a] focus:outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/20';
const labelClass = 'block text-xs font-medium text-[#A0A0A0] mb-1';

export default function SampleFormModal({ sample, job, allStaff, labs, suppliers, saving, onSave, onClose, defaultBoreholeRef }) {
  const [form, setForm] = useState({
    sample_id: sample?.sample_id || '',
    borehole_ref: sample?.borehole_ref || defaultBoreholeRef || '',
    sample_type: sample?.sample_type || 'disturbed',
    depth_from: sample?.depth_from || '',
    depth_to: sample?.depth_to || '',
    strata_descriptor: sample?.strata_descriptor || '',
    collection_date: sample?.collection_date || new Date().toISOString().slice(0, 10),
    collected_by_staff_id: sample?.collected_by_staff_id || '',
    container_type: sample?.container_type || 'bag',
    container_count: sample?.container_count || 1,
    storage_location: sample?.storage_location || '',
    storage_temperature: sample?.storage_temperature || 'ambient',
    lab_id: sample?.lab_id || '',
    test_schedule: sample?.test_schedule || [],
    dispatch_date: sample?.dispatch_date || '',
    tracking_number: sample?.tracking_number || '',
    retention_expiry_date: sample?.retention_expiry_date || '',
    notes: sample?.notes || '',
  });

  const toggleTest = (t) => {
    setForm(prev => ({
      ...prev,
      test_schedule: prev.test_schedule.includes(t)
        ? prev.test_schedule.filter(x => x !== t)
        : [...prev.test_schedule, t],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
      depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
      container_count: parseInt(form.container_count) || 1,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1C201C] border-[#2a3a2a] text-[#E0E0E0]">
        <DialogHeader>
          <DialogTitle className="text-[#E0E0E0]">{sample ? 'Edit Sample' : 'Register New Sample'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Sample ID *</label>
              <input required value={form.sample_id} onChange={e => setForm({ ...form, sample_id: e.target.value })}
                placeholder="e.g. BH01-S-003"
                className={inputClass + ' font-mono'} />
            </div>
            <div>
              <label className={labelClass}>Borehole Ref</label>
              <input value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                placeholder="e.g. BH-01"
                className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Sample Type *</label>
              <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })}
                className={inputClass}>
                {SAMPLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Depth From (m)</label>
              <input type="number" step="0.01" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Depth To (m)</label>
              <input type="number" step="0.01" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Strata Description</label>
            <input value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })}
              placeholder="e.g. Stiff grey CLAY"
              className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Collection Date *</label>
              <input type="date" required value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Collected By</label>
              <select value={form.collected_by_staff_id} onChange={e => setForm({ ...form, collected_by_staff_id: e.target.value })}
                className={inputClass}>
                <option value="">Select staff...</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Container</label>
              <select value={form.container_type} onChange={e => setForm({ ...form, container_type: e.target.value })}
                className={inputClass}>
                <option value="bag">Bag</option>
                <option value="jar">Jar</option>
                <option value="u100_tube">U100 Tube</option>
                <option value="spt_tube">SPT Tube</option>
                <option value="core_box">Core Box</option>
                <option value="water_bottle">Water Bottle</option>
                <option value="gas_bag">Gas Bag</option>
                <option value="amber_jar">Amber Jar</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Count</label>
              <input type="number" min="1" value={form.container_count} onChange={e => setForm({ ...form, container_count: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Storage Temp</label>
              <select value={form.storage_temperature} onChange={e => setForm({ ...form, storage_temperature: e.target.value })}
                className={inputClass}>
                <option value="ambient">Ambient</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="frozen">Frozen</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Laboratory</label>
            <select value={form.lab_id} onChange={e => setForm({ ...form, lab_id: e.target.value })}
              className={inputClass}>
              <option value="">Select lab...</option>
              {(labs.length > 0 ? labs : suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass + ' mb-2'}>Test Schedule</label>
            <div className="flex flex-wrap gap-1.5">
              {TEST_OPTIONS.map(t => (
                <button key={t} type="button" onClick={() => toggleTest(t)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition ${
                    form.test_schedule.includes(t)
                      ? 'bg-[#FF9F1C] text-[#1a1a1a] border-[#FF9F1C]'
                      : 'bg-[#0B1A0B] text-[#A0A0A0] border-[#2a3a2a] hover:border-[#FF9F1C]/50'
                  }`}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2"
              className={inputClass} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-[#E0E0E0]">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF9F1C] text-[#1a1a1a] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {sample ? 'Update' : 'Register'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}