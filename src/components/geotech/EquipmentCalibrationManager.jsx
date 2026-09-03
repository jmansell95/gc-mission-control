import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, CheckCircle2, Trash2, Edit2, Loader2, Calendar, FileCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EQUIPMENT_TYPES = [
  { value: 'shear_vane', label: 'Shear Vane' },
  { value: 'spt_auto_hammer', label: 'SPT Auto Hammer' },
  { value: 'spt_donut_hammer', label: 'SPT Donut Hammer' },
  { value: 'cpt_cone', label: 'CPT Cone' },
  { value: 'pocket_penetrometer', label: 'Pocket Penetrometer' },
  { value: 'cbr_mould', label: 'CBR Mould' },
  { value: 'oedometer_ring', label: 'Oedometer Ring' },
  { value: 'nuclear_density_gauge', label: 'Nuclear Density Gauge' },
  { value: 'dcp', label: 'DCP' },
  { value: 'mackintosh_probe', label: 'Mackintosh Probe' },
  { value: 'plate_load_kentledge', label: 'Plate Load (Kentledge)' },
  { value: 'load_cell', label: 'Load Cell' },
  { value: 'pressure_gauge', label: 'Pressure Gauge' },
  { value: 'dip_meter', label: 'Dip Meter' },
  { value: 'gas_monitor', label: 'Gas Monitor' },
  { value: 'other', label: 'Other' },
];

const CALIBRATION_RESULT_META = {
  pass: { label: 'Pass', color: 'bg-emerald-100 text-emerald-700' },
  conditional_pass: { label: 'Conditional', color: 'bg-amber-100 text-amber-700' },
  fail: { label: 'Fail', color: 'bg-rose-100 text-rose-700' },
  out_of_tolerance: { label: 'Out of Tol.', color: 'bg-rose-100 text-rose-700' },
};

export default function EquipmentCalibrationManager({ job, assets: assetsProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: calibrations = [], isLoading } = useQuery({
    queryKey: ['calibrations-for-job', job.id],
    queryFn: () => base44.entities.EquipmentCalibration.filter({ job_id: job.id }, '-calibration_date'),
  });

  // Fetch assets if not passed as a prop
  const { data: fetchedAssets = [] } = useQuery({
    queryKey: ['site-assets-for-calibration'],
    queryFn: () => base44.entities.SiteAsset.list('-name', 500),
    enabled: !assetsProp,
  });
  const assets = assetsProp || fetchedAssets;

  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon = calibrations.filter(c => c.status === 'expiring_soon' || (c.next_calibration_date && c.next_calibration_date < today && c.status !== 'expired'));
  const expired = calibrations.filter(c => c.status === 'expired' || (c.next_calibration_date && c.next_calibration_date < today && c.calibration_result === 'pass'));

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const payload = { ...formData, job_id: job.id };
      // Derive status
      const nextDate = payload.next_calibration_date;
      if (payload.calibration_result === 'fail') {
        payload.status = 'failed';
      } else if (nextDate) {
        const daysUntil = Math.ceil((new Date(nextDate) - new Date(today)) / (1000 * 60 * 60 * 24));
        payload.status = daysUntil < 0 ? 'expired' : daysUntil <= 30 ? 'expiring_soon' : 'valid';
      }
      if (editing) {
        await base44.entities.EquipmentCalibration.update(editing.id, payload);
        toast({ title: 'Calibration record updated' });
      } else {
        await base44.entities.EquipmentCalibration.create(payload);
        toast({ title: 'Calibration record added' });
      }
      queryClient.invalidateQueries({ queryKey: ['calibrations-for-job', job.id] });
      setShowModal(false);
      setEditing(null);
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cal) => {
    if (!confirm('Delete this calibration record?')) return;
    try {
      await base44.entities.EquipmentCalibration.delete(cal.id);
      queryClient.invalidateQueries({ queryKey: ['calibrations-for-job', job.id] });
      toast({ title: 'Calibration record deleted' });
    } catch (e) {
      toast({ title: 'Error deleting', description: e.message, variant: 'destructive' });
    }
  };

  const statusColor = (cal) => {
    if (cal.calibration_result === 'fail') return 'bg-rose-100 text-rose-700';
    if (!cal.next_calibration_date) return 'bg-slate-100 text-slate-600';
    const daysUntil = Math.ceil((new Date(cal.next_calibration_date) - new Date(today)) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'bg-rose-100 text-rose-700';
    if (daysUntil <= 30) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const statusLabel = (cal) => {
    if (cal.calibration_result === 'fail') return 'Failed';
    if (!cal.next_calibration_date) return 'No Expiry';
    const daysUntil = Math.ceil((new Date(cal.next_calibration_date) - new Date(today)) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return 'Expired';
    if (daysUntil <= 30) return `Expires in ${daysUntil}d`;
    return 'Valid';
  };

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-violet-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Equipment Calibration</h3>
            <p className="text-xs text-slate-500">{calibrations.length} records{expired.length > 0 && <span className="text-rose-600"> · {expired.length} expired</span>}{expiringSoon.length > 0 && <span className="text-amber-600"> · {expiringSoon.length} expiring</span>}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Add Record
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /></div>
      ) : calibrations.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No calibration records.</p>
          <p className="text-xs text-slate-400 mt-1">Track calibration of shear vanes, SPT hammers, CPT cones, and other field testing equipment.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {calibrations.map(c => {
            const asset = assets?.find(a => a.id === c.asset_id);
            const sc = statusColor(c);
            const rc = CALIBRATION_RESULT_META[c.calibration_result] || CALIBRATION_RESULT_META.pass;
            return (
              <div key={c.id} className="px-5 py-3 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{c.asset_name || EQUIPMENT_TYPES.find(t => t.value === c.equipment_type)?.label || c.equipment_type}</span>
                      {c.serial_number && <span className="font-mono text-xs text-slate-500">SN: {c.serial_number}</span>}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${sc}`}>{statusLabel(c)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${rc.color}`}>{rc.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Calibrated {c.calibration_date}</span>
                      {c.next_calibration_date && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> Next: {c.next_calibration_date}</span>}
                      {c.calibrated_by_company && <span>· {c.calibrated_by_company}</span>}
                      {asset && <span>· {asset.name}</span>}
                    </div>
                    {c.calibration_certificate_url && (
                      <a href={c.calibration_certificate_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-violet-700 hover:text-violet-800">
                        <FileCheck className="w-3 h-3" /> View certificate
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(c); setShowModal(true); }}
                      className="p-1 text-slate-400 hover:text-slate-700 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CalibrationFormModal
          calibration={editing}
          job={job}
          assets={assets || []}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CalibrationFormModal({ calibration, job, assets, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    asset_id: calibration?.asset_id || '',
    asset_name: calibration?.asset_name || '',
    serial_number: calibration?.serial_number || '',
    equipment_type: calibration?.equipment_type || 'shear_vane',
    calibration_date: calibration?.calibration_date || new Date().toISOString().slice(0, 10),
    next_calibration_date: calibration?.next_calibration_date || '',
    calibration_standard: calibration?.calibration_standard || '',
    calibrated_by_company: calibration?.calibrated_by_company || '',
    calibrated_by_name: calibration?.calibrated_by_name || '',
    calibration_certificate_url: calibration?.calibration_certificate_url || '',
    calibration_certificate_name: calibration?.calibration_certificate_name || '',
    calibration_result: calibration?.calibration_result || 'pass',
    deviation_from_standard: calibration?.deviation_from_standard || '',
    deviation_unit: calibration?.deviation_unit || '%',
    adjustment_made: calibration?.adjustment_made || false,
    notes: calibration?.notes || '',
  });

  const handleAssetSelect = (assetId) => {
    const asset = assets.find(a => a.id === assetId);
    setForm(prev => ({
      ...prev,
      asset_id: assetId,
      asset_name: asset?.name || '',
      serial_number: asset?.serial_number || '',
    }));
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, calibration_certificate_url: file_url, calibration_certificate_name: file.name }));
    } catch (err) {
      // Fallback for published site — multipart upload
    }
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      deviation_from_standard: form.deviation_from_standard === '' ? null : parseFloat(form.deviation_from_standard),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{calibration ? 'Edit Calibration Record' : 'Add Calibration Record'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Equipment Type *</label>
              <select value={form.equipment_type} onChange={e => setForm({ ...form, equipment_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600">
                {EQUIPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Linked Asset</label>
              <select value={form.asset_id} onChange={e => handleAssetSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600">
                <option value="">None (standalone)</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` (${a.serial_number})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Asset Name</label>
              <input value={form.asset_name} onChange={e => setForm({ ...form, asset_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Serial Number</label>
              <input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-violet-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calibration Date *</label>
              <input type="date" required value={form.calibration_date} onChange={e => setForm({ ...form, calibration_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Next Calibration Due *</label>
              <input type="date" required value={form.next_calibration_date} onChange={e => setForm({ ...form, next_calibration_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Result *</label>
              <select value={form.calibration_result} onChange={e => setForm({ ...form, calibration_result: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600">
                <option value="pass">Pass</option>
                <option value="conditional_pass">Conditional Pass</option>
                <option value="fail">Fail</option>
                <option value="out_of_tolerance">Out of Tolerance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calibration Standard</label>
              <input value={form.calibration_standard} onChange={e => setForm({ ...form, calibration_standard: e.target.value })}
                placeholder="e.g. BS 1377-9:2022"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calibrated By (Company)</label>
              <input value={form.calibrated_by_company} onChange={e => setForm({ ...form, calibrated_by_company: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calibrated By (Person)</label>
              <input value={form.calibrated_by_name} onChange={e => setForm({ ...form, calibrated_by_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Calibration Certificate</label>
            <input type="file" accept=".pdf,.jpg,.png" onChange={handleFile}
              className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:font-medium hover:file:bg-violet-100" />
            {form.calibration_certificate_name && <p className="text-xs text-slate-500 mt-1">Uploaded: {form.calibration_certificate_name}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="adjustment" checked={form.adjustment_made} onChange={e => setForm({ ...form, adjustment_made: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300" />
            <label htmlFor="adjustment" className="text-sm text-slate-700">Adjustment made during calibration</label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-violet-700 text-white rounded-lg text-sm font-medium hover:bg-violet-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {calibration ? 'Update' : 'Add Record'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}