import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Save, Upload, ShieldCheck, ClipboardCheck, Plug, Wrench, CalendarClock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { safeFormat } from '@/utils/format';
import { closeOpenRecertTasks } from '@/utils/recertTasks';

const RECORD_TYPES = [
  { value: 'loler_inspection', label: 'LOLER Inspection', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'puwer_inspection', label: 'PUWER Inspection', icon: ClipboardCheck, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'pat_inspection', label: 'PAT Test', icon: Plug, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'service', label: 'Service', icon: Wrench, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const RESULTS = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'n/a', label: 'N/A' },
];

function defaultType(assetType) {
  if (assetType === 'lifting' || assetType === 'rig') return 'loler_inspection';
  if (assetType === 'portable_appliance') return 'pat_inspection';
  if (assetType === 'machinery' || assetType === 'trailer' || assetType === 'vehicle') return 'puwer_inspection';
  return 'loler_inspection';
}

/**
 * Quick re-certification modal — streamlines logging a new statutory
 * inspection (LOLER/PUWER/PAT) and auto-updates the asset's compliance
 * snapshot + expiry date so the pipeline clears immediately.
 */
export default function RecertActionModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState({
    record_type: defaultType(asset?.asset_type),
    date: new Date().toISOString().slice(0, 10),
    result: 'pass', tested_by: '', company: '',
    resulting_expiry_date: '', notes: '',
    certificate_url: '', certificate_name: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { if (asset) setForm(f => ({ ...f, record_type: defaultType(asset.asset_type) })); }, [asset]);

  if (!asset) return null;
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set('certificate_url', file_url);
      set('certificate_name', file.name);
    } catch (e) { toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.date) { toast({ title: 'Date required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let expiryDate = form.resulting_expiry_date || null;
      if (!expiryDate && ['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(form.record_type)) {
        const cfg = await base44.entities.ComplianceConfig.filter({ key: 'global' });
        const c = cfg[0] || {};
        const interval = form.record_type === 'loler_inspection' ? (Number(c.default_loler_interval_months) || 6)
          : form.record_type === 'pat_inspection' ? (Number(c.default_pat_interval_months) || 12)
          : (Number(c.default_puwer_interval_months) || 12);
        const d = new Date(form.date + 'T00:00:00'); d.setMonth(d.getMonth() + interval);
        expiryDate = d.toISOString().slice(0, 10);
      }
      await base44.entities.ServiceRecord.create({
        site_asset_id: asset.id,
        record_type: form.record_type,
        date: form.date,
        result: form.result,
        tested_by: form.tested_by,
        company: form.company,
        resulting_expiry_date: expiryDate,
        notes: form.notes,
        certificate_url: form.certificate_url || '',
        certificate_name: form.certificate_name || '',
      });
      const reactivating = form.result === 'pass' && asset.is_active === false;
      if (['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(form.record_type)) {
        const warnDays = 30;
        const daysUntil = expiryDate ? Math.floor((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000) : null;
        const status = form.result === 'fail' ? 'expired'
          : form.result === 'advisory' ? 'expiring'
          : (daysUntil !== null && daysUntil < 0) ? 'expired'
          : (daysUntil !== null && daysUntil <= warnDays) ? 'expiring'
          : 'compliant';
        await base44.entities.SiteAsset.update(asset.id, {
          last_service_date: form.date,
          next_service_date: expiryDate || null,
          compliance_expiry_date: expiryDate || null,
          compliance_status: status,
          compliance_last_checked: new Date().toISOString(),
          ...(reactivating ? { is_active: true } : {}),
        });
      }
      // Close any open auto-created recert task now that a passing inspection is logged
      if (form.result === 'pass') {
        await closeOpenRecertTasks(asset.id);
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['cert-vault'] });
      queryClient.invalidateQueries({ queryKey: ['master-cert-vault'] });
      queryClient.invalidateQueries({ queryKey: ['recert-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['open-recert-tasks'] });
      toast({ title: 'Re-cert logged', description: `${asset.name} marked ${form.result === 'fail' ? 'failed' : 'compliant'} · next due ${expiryDate ? safeFormat(expiryDate, 'dd MMM yyyy') : 'n/a'}${form.result === 'pass' && asset.is_active === false ? ' · reactivated' : ''}.` });
      onSaved?.();
      onClose();
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Log Re-certification</h3>
              <p className="text-xs text-slate-400">{asset.name} · {asset.equipment_type || asset.asset_type}</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {asset.compliance_status === 'expired' && (
            <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">This asset is currently expired — log a passing inspection to reactivate it.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Inspection Type</label>
              <select value={form.record_type} onChange={e => set('record_type', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Result</label>
              <select value={form.result} onChange={e => set('result', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Next Test Due (auto if blank)</label>
              <input type="date" value={form.resulting_expiry_date} onChange={e => set('resulting_expiry_date', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Tested By</label>
              <input type="text" value={form.tested_by} onChange={e => set('tested_by', e.target.value)} placeholder="Name" className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Company</label>
              <input type="text" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Testing company" className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Findings, defects, parts replaced..." className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Certificate / Report (optional)</label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleUpload(e.target.files?.[0])} disabled={uploading} />
              </label>
              {form.certificate_name && <span className="text-xs text-emerald-700 font-medium truncate">{form.certificate_name}</span>}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
          <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Log Re-cert'}
          </button>
        </div>
      </div>
    </div>
  );
}