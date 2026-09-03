import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Waves, Plus, X, CheckCircle2, Trash2, Edit2, Loader2, AlertTriangle, Droplets, Gauge } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const WELL_TYPES = [
  { value: 'standpipe_piezometer', label: 'Standpipe Piezometer' },
  { value: 'response_piezometer', label: 'Response Piezometer' },
  { value: 'vibrating_wire_piezometer', label: 'Vibrating Wire Piezometer' },
  { value: 'observation_well', label: 'Observation Well' },
  { value: 'gas_monitoring_point', label: 'Gas Monitoring Point' },
  { value: 'combined_groundwater_gas', label: 'Combined GW + Gas' },
  { value: 'settlement_plate', label: 'Settlement Plate' },
  { value: 'extensometer', label: 'Extensometer' },
];

const STATUS_META = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  dormant: { label: 'Dormant', color: 'bg-slate-100 text-slate-600' },
  decommissioned: { label: 'Decommissioned', color: 'bg-slate-200 text-slate-500' },
  damaged: { label: 'Damaged', color: 'bg-rose-100 text-rose-700' },
};

export default function MonitoringWellManager({ job, allStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: wells = [], isLoading } = useQuery({
    queryKey: ['monitoring-wells-for-job', job.id],
    queryFn: () => base44.entities.MonitoringWell.filter({ job_id: job.id }, 'installation_date'),
  });

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const payload = { ...formData, job_id: job.id };
      if (editing) {
        await base44.entities.MonitoringWell.update(editing.id, payload);
        toast({ title: 'Monitoring well updated' });
      } else {
        await base44.entities.MonitoringWell.create(payload);
        toast({ title: 'Monitoring well added' });
      }
      queryClient.invalidateQueries({ queryKey: ['monitoring-wells-for-job', job.id] });
      setShowModal(false);
      setEditing(null);
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (well) => {
    if (!confirm(`Delete monitoring well ${well.well_reference}?`)) return;
    try {
      await base44.entities.MonitoringWell.delete(well.id);
      queryClient.invalidateQueries({ queryKey: ['monitoring-wells-for-job', job.id] });
      toast({ title: 'Well deleted' });
    } catch (e) {
      toast({ title: 'Error deleting', description: e.message, variant: 'destructive' });
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdueWells = wells.filter(w => w.status === 'active' && w.next_reading_due && w.next_reading_due < today);

  const WELL_STATUS_DARK = {
    active: { label: 'Active', ring: '#2EFF7D' },
    dormant: { label: 'Dormant', ring: '#94A3B8' },
    decommissioned: { label: 'Decommissioned', ring: '#5a6a5a' },
    damaged: { label: 'Damaged', ring: '#F43F5E' },
  };

  return (
    <div className="bg-[#1C201C] rounded-xl border border-[#2a3a2a] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a3a2a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0B1A0B] border border-[#2a3a2a] flex items-center justify-center">
            <Waves className="w-4 h-4 text-[#00D4FF]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#E0E0E0] text-sm">Monitoring Wells</h3>
            <p className="text-xs text-[#A0A0A0]">{wells.length} wells · {wells.filter(w => w.status === 'active').length} active{overdueWells.length > 0 && <span style={{ color: '#F43F5E' }}> · {overdueWells.length} overdue</span>}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9F1C] text-[#1a1a1a] rounded-lg hover:brightness-110 transition text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Add Well
        </button>
      </div>

      {overdueWells.length > 0 && (
        <div className="px-5 py-2.5 border-b border-[#2a3a2a] flex items-center gap-2" style={{ backgroundColor: '#F43F5E0d' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#F43F5E' }} />
          <p className="text-xs" style={{ color: '#F43F5E' }}>
            {overdueWells.length} well{overdueWells.length > 1 ? 's' : ''} overdue for reading: {overdueWells.map(w => w.well_reference).join(', ')}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-[#2EFF7D] animate-spin" /></div>
      ) : wells.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Waves className="w-8 h-8 text-[#2a3a2a] mx-auto mb-2" />
          <p className="text-sm text-[#A0A0A0]">No monitoring wells installed.</p>
          <p className="text-xs text-[#5a6a5a] mt-1">Add standpipe piezometers, gas monitoring points, or VWPs installed in boreholes.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#2a3a2a]">
          {wells.map(w => {
            const installer = allStaff.find(s => s.id === w.installed_by_staff_id);
            const status = WELL_STATUS_DARK[w.status] || WELL_STATUS_DARK.active;
            const isOverdue = w.status === 'active' && w.next_reading_due && w.next_reading_due < today;
            return (
              <div key={w.id} className="px-5 py-3 hover:bg-[#1e241e] transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-[#E0E0E0]">{w.well_reference}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ backgroundColor: `${status.ring}1a`, color: status.ring, border: `1px solid ${status.ring}40` }}>{status.label}</span>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: '#F43F5E1a', color: '#F43F5E', border: '1px solid #F43F5E40' }}>
                          <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#A0A0A0] mt-1">
                      {WELL_TYPES.find(t => t.value === w.well_type)?.label || w.well_type}
                      {w.borehole_ref && <span> · in {w.borehole_ref}</span>}
                      {w.tip_depth != null && <span> · tip {w.tip_depth}m</span>}
                      {w.screen_top != null && w.screen_bottom != null && <span> · screen {w.screen_top}–{w.screen_bottom}m</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#5a6a5a]">
                      {w.monitoring_type === 'groundwater' && <span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> Groundwater</span>}
                      {w.monitoring_type === 'ground_gas' && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> Gas</span>}
                      {w.monitoring_type === 'combined' && <span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> GW + Gas</span>}
                      {w.monitoring_frequency_days && <span>· every {w.monitoring_frequency_days}d</span>}
                      {w.last_reading_date && <span>· last read {w.last_reading_date}</span>}
                      {installer && <span>· installed by {installer.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(w); setShowModal(true); }}
                      className="p-1 text-[#5a6a5a] hover:text-[#E0E0E0] transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(w)}
                      className="p-1 text-[#5a6a5a] hover:text-[#F43F5E] transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <WellFormModal
          well={editing}
          job={job}
          allStaff={allStaff}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function WellFormModal({ well, job, allStaff, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    well_reference: well?.well_reference || '',
    borehole_ref: well?.borehole_ref || '',
    well_type: well?.well_type || 'standpipe_piezometer',
    installation_date: well?.installation_date || new Date().toISOString().slice(0, 10),
    installed_by_staff_id: well?.installed_by_staff_id || '',
    tip_depth: well?.tip_depth || '',
    screen_top: well?.screen_top || '',
    screen_bottom: well?.screen_bottom || '',
    response_zone_strata: well?.response_zone_strata || '',
    casing_diameter_mm: well?.casing_diameter_mm || 50,
    casing_material: well?.casing_material || 'pvc',
    gravel_pack_depth_from: well?.gravel_pack_depth_from || '',
    gravel_pack_depth_to: well?.gravel_pack_depth_to || '',
    bentonite_seal_depth_from: well?.bentonite_seal_depth_from || '',
    bentonite_seal_depth_to: well?.bentonite_seal_depth_to || '',
    headworks_type: well?.headworks_type || 'flush_gladed',
    headworks_locked: well?.headworks_locked || false,
    ground_level: well?.ground_level || '',
    top_of_casing: well?.top_of_casing || '',
    monitoring_type: well?.monitoring_type || 'groundwater',
    monitoring_frequency_days: well?.monitoring_frequency_days || 7,
    monitoring_start_date: well?.monitoring_start_date || '',
    monitoring_end_date: well?.monitoring_end_date || '',
    status: well?.status || 'active',
    notes: well?.notes || '',
  });

  const submit = (e) => {
    e.preventDefault();
    const numFields = ['tip_depth', 'screen_top', 'screen_bottom', 'casing_diameter_mm',
      'gravel_pack_depth_from', 'gravel_pack_depth_to', 'bentonite_seal_depth_from',
      'bentonite_seal_depth_to', 'ground_level', 'top_of_casing', 'monitoring_frequency_days'];
    const payload = { ...form };
    numFields.forEach(f => { payload[f] = payload[f] === '' ? null : parseFloat(payload[f]); });
    onSave(payload);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{well ? 'Edit Monitoring Well' : 'Add Monitoring Well'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Well Reference *</label>
              <input required value={form.well_reference} onChange={e => setForm({ ...form, well_reference: e.target.value })}
                placeholder="e.g. SPZ-01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Borehole Ref</label>
              <input value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                placeholder="e.g. BH-01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Well Type *</label>
              <select value={form.well_type} onChange={e => setForm({ ...form, well_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600">
                {WELL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monitoring Type</label>
              <select value={form.monitoring_type} onChange={e => setForm({ ...form, monitoring_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600">
                <option value="groundwater">Groundwater</option>
                <option value="ground_gas">Ground Gas</option>
                <option value="combined">Combined</option>
                <option value="pore_water_pressure">Pore Water Pressure</option>
                <option value="settlement">Settlement</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Installation Date *</label>
              <input type="date" required value={form.installation_date} onChange={e => setForm({ ...form, installation_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Installed By</label>
              <select value={form.installed_by_staff_id} onChange={e => setForm({ ...form, installed_by_staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600">
                <option value="">Select...</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Frequency (days)</label>
              <input type="number" min="1" value={form.monitoring_frequency_days} onChange={e => setForm({ ...form, monitoring_frequency_days: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Installation Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tip Depth (m)</label>
                <input type="number" step="0.01" value={form.tip_depth} onChange={e => setForm({ ...form, tip_depth: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Screen Top (m)</label>
                <input type="number" step="0.01" value={form.screen_top} onChange={e => setForm({ ...form, screen_top: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Screen Bottom (m)</label>
                <input type="number" step="0.01" value={form.screen_bottom} onChange={e => setForm({ ...form, screen_bottom: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Response Zone Strata</label>
                <input value={form.response_zone_strata} onChange={e => setForm({ ...form, response_zone_strata: e.target.value })}
                  placeholder="e.g. Medium dense SAND"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Casing Dia (mm)</label>
                <input type="number" value={form.casing_diameter_mm} onChange={e => setForm({ ...form, casing_diameter_mm: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gravel Pack (m from–to)</label>
                <div className="flex gap-1">
                  <input type="number" step="0.01" placeholder="from" value={form.gravel_pack_depth_from} onChange={e => setForm({ ...form, gravel_pack_depth_from: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
                  <input type="number" step="0.01" placeholder="to" value={form.gravel_pack_depth_to} onChange={e => setForm({ ...form, gravel_pack_depth_to: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bentonite Seal (m from–to)</label>
                <div className="flex gap-1">
                  <input type="number" step="0.01" placeholder="from" value={form.bentonite_seal_depth_from} onChange={e => setForm({ ...form, bentonite_seal_depth_from: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
                  <input type="number" step="0.01" placeholder="to" value={form.bentonite_seal_depth_to} onChange={e => setForm({ ...form, bentonite_seal_depth_to: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {well ? 'Update' : 'Add Well'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}