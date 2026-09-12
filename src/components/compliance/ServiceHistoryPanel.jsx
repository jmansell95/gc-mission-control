import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Save, FileText, ShieldCheck, Wrench, AlertTriangle, CalendarClock, Upload, ExternalLink, ClipboardCheck, Plug } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { safeFormat } from '@/utils/format';
import { closeOpenRecertTasks } from '@/utils/recertTasks';

const RECORD_TYPES = [
  { value: 'loler_inspection', label: 'LOLER Inspection', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'puwer_inspection', label: 'PUWER Inspection', icon: ClipboardCheck, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'pat_inspection', label: 'PAT Test', icon: Plug, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'service', label: 'Service', icon: Wrench, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  { value: 'repair', label: 'Repair', icon: Wrench, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'calibration', label: 'Calibration', icon: ClipboardCheck, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'pre_use_check', label: 'Pre-use Check', icon: ClipboardCheck, tint: 'bg-slate-50 text-slate-600 border-slate-200' },
  { value: 'other', label: 'Other', icon: FileText, tint: 'bg-slate-50 text-slate-600 border-slate-200' },
];

const RESULTS = [
  { value: 'pass', label: 'Pass', dot: 'bg-emerald-500' },
  { value: 'fail', label: 'Fail', dot: 'bg-red-500' },
  { value: 'advisory', label: 'Advisory', dot: 'bg-amber-500' },
  { value: 'n/a', label: 'N/A', dot: 'bg-slate-400' },
];

function typeMeta(value) { return RECORD_TYPES.find(t => t.value === value) || RECORD_TYPES[6]; }
function resultMeta(value) { return RESULTS.find(r => r.value === value) || RESULTS[0]; }

export default function ServiceHistoryPanel({ assetId, assetName, assetType }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    record_type: 'loler_inspection', date: new Date().toISOString().slice(0, 10),
    result: 'pass', tested_by: '', company: '', resulting_expiry_date: '', notes: '',
    certificate_url: '', certificate_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['service-records', assetId],
    queryFn: () => base44.entities.ServiceRecord.filter({ site_asset_id: assetId }, '-date', 100),
    enabled: !!assetId,
  });

  const { data: compConfig } = useQuery({
    queryKey: ['compliance-config'],
    queryFn: async () => { const l = await base44.entities.ComplianceConfig.filter({ key: 'global' }); return l[0] || null; },
  });

  const defaultRecordType = () => {
    if (assetType === 'lifting' || assetType === 'rig') return 'loler_inspection';
    if (assetType === 'portable_appliance') return 'pat_inspection';
    if (assetType === 'machinery' || assetType === 'trailer' || assetType === 'vehicle') return 'puwer_inspection';
    return 'loler_inspection';
  };

  const openForm = () => {
    setForm({
      record_type: defaultRecordType(), date: new Date().toISOString().slice(0, 10),
      result: 'pass', tested_by: '', company: '', resulting_expiry_date: '', notes: '',
      certificate_url: '', certificate_name: '',
    });
    setShowForm(true);
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set('certificate_url', file_url);
      set('certificate_name', file.name);
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.date) { toast({ title: 'Date required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      // Auto-calculate next-due date from the compliance rules when not entered manually
      let expiryDate = form.resulting_expiry_date || null;
      if (!expiryDate && ['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(form.record_type)) {
        const interval = form.record_type === 'loler_inspection' ? (Number(compConfig?.default_loler_interval_months) || 6)
          : form.record_type === 'pat_inspection' ? (Number(compConfig?.default_pat_interval_months) || 12)
          : (Number(compConfig?.default_puwer_interval_months) || 12);
        const d = new Date(form.date + 'T00:00:00');
        d.setMonth(d.getMonth() + interval);
        expiryDate = d.toISOString().slice(0, 10);
      }
      await base44.entities.ServiceRecord.create({
        site_asset_id: assetId,
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
      // Update the parent asset's compliance snapshot from this latest record
      if (['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(form.record_type)) {
        const warnDays = Number(compConfig?.expiring_warning_days) || 30;
        const daysUntil = expiryDate ? Math.floor((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000) : null;
        const status = form.result === 'fail' ? 'expired'
          : form.result === 'advisory' ? 'expiring'
          : (daysUntil !== null && daysUntil < 0) ? 'expired'
          : (daysUntil !== null && daysUntil <= warnDays) ? 'expiring'
          : 'compliant';
        // Reactivate the asset if it was deactivated and this is a passing inspection
        const existingAsset = await base44.entities.SiteAsset.get(assetId);
        const reactivating = form.result === 'pass' && existingAsset?.is_active === false;
        await base44.entities.SiteAsset.update(assetId, {
          last_service_date: form.date,
          next_service_date: expiryDate || null,
          compliance_expiry_date: expiryDate || null,
          compliance_status: status,
          compliance_last_checked: new Date().toISOString(),
          service_notes: form.notes ? `${form.tested_by ? 'Tested by ' + form.tested_by + ': ' : ''}${form.notes}` : '',
          ...(reactivating ? { is_active: true } : {}),
        });
        // Close any open auto-created recert task when a passing statutory inspection is logged
        if (form.result === 'pass' && ['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(form.record_type)) {
          await closeOpenRecertTasks(assetId);
        }
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        queryClient.invalidateQueries({ queryKey: ['open-recert-tasks'] });
      }
      queryClient.invalidateQueries({ queryKey: ['service-records', assetId] });
      toast({ title: 'Service record added', description: `${typeMeta(form.record_type).label} logged for ${assetName}.` });
      setShowForm(false);
      setForm({ record_type: 'loler_inspection', date: new Date().toISOString().slice(0, 10), result: 'pass', tested_by: '', company: '', resulting_expiry_date: '', notes: '', certificate_url: '', certificate_name: '' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.ServiceRecord.delete(id);
      queryClient.invalidateQueries({ queryKey: ['service-records', assetId] });
      toast({ title: 'Record deleted' });
      setDeleteId(null);
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Inspection & Service History</p>
        <button onClick={() => showForm ? setShowForm(false) : openForm()} type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition">
          <Plus className="w-3.5 h-3.5" /> Log Service
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">New Service Record</p>
            <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:bg-white rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Type</label>
              <select value={form.record_type} onChange={e => set('record_type', e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Result</label>
              <select value={form.result} onChange={e => set('result', e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Next Test Due</label>
              <input type="date" value={form.resulting_expiry_date} onChange={e => set('resulting_expiry_date', e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Tested By</label>
              <input type="text" value={form.tested_by} onChange={e => set('tested_by', e.target.value)} placeholder="Name"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Company</label>
              <input type="text" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Testing company"
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Findings, defects, parts replaced..."
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
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
          <button onClick={handleSave} disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-slate-400 italic">Loading history…</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No service records yet. Log the first inspection or service above.</p>
      ) : (
        <div className="relative pl-5 space-y-3">
          {/* timeline line */}
          <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200" />
          {records.map(r => {
            const tm = typeMeta(r.record_type);
            const rm = resultMeta(r.result);
            const TIcon = tm.icon;
            return (
              <div key={r.id} className="relative">
                <div className={`absolute -left-[15px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${rm.dot}`} />
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border ${tm.tint}`}>
                        <TIcon className="w-3 h-3" /> {tm.label}
                      </span>
                      {r.imported_from_gc && (
                        <span className="text-[10px] text-slate-400 font-medium">from GC</span>
                      )}
                    </div>
                    {deleteId === r.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-red-600 font-medium">Delete?</span>
                        <button onClick={() => handleDelete(r.id)} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-semibold">Yes</button>
                        <button onClick={() => setDeleteId(null)} className="text-[10px] px-1.5 py-0.5 text-slate-500">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(r.id)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700"><CalendarClock className="w-3 h-3" /> {safeFormat(r.date, 'dd MMM yyyy')}</span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${r.result === 'fail' ? 'text-red-600' : r.result === 'advisory' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${rm.dot}`} /> {rm.label}
                    </span>
                    {r.tested_by && <span>· {r.tested_by}</span>}
                    {r.company && <span>· {r.company}</span>}
                  </div>
                  {r.resulting_expiry_date && (
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Next due: {safeFormat(r.resulting_expiry_date, 'dd MMM yyyy')}
                    </p>
                  )}
                  {r.notes && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{r.notes}</p>}
                  {r.certificate_url && (
                    <a href={r.certificate_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1.5 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {r.certificate_name || 'View certificate'}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}