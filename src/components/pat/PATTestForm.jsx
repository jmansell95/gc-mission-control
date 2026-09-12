import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Save, Plug, CheckCircle2, XCircle, AlertTriangle, Zap, Shield,
  Cable, Gauge, ClipboardCheck, Printer, Upload,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { safeFormat } from '@/utils/format';
import { saveOrQueue } from '@/utils/offlineSync';

const APPLIANCE_CLASSES = [
  { value: 'class_I', label: 'Class I (Earthed)', needs_earth: true, desc: 'Metal casing, needs earth bond' },
  { value: 'class_II', label: 'Class II (Double Insulated)', needs_earth: false, desc: 'No earth — symbol on casing' },
  { value: 'class_III', label: 'Class III (SELV)', needs_earth: false, desc: 'Extra-low voltage (110V)' },
  { value: 'extension_lead', label: 'Extension Lead / IEC', needs_earth: true, desc: 'Lead or reel — polarity check' },
];

/**
 * PAT Test Form — the digital record the tester fills in at the appliance.
 * Captures the KEWPAT readings (earth continuity, insulation, leakage, load,
 * polarity) and auto-calculates the pass/fail. On save, creates a
 * pat_inspection ServiceRecord and pushes the new expiry onto the asset so the
 * pipeline clears immediately.
 */
export default function PATTestForm({ asset, onClose, onSaved }) {
  const [form, setForm] = useState({
    appliance_class: 'class_I',
    visual_pass: true,
    earth_continuity: '',
    insulation_resistance: '',
    load_current: '',
    leakage_current: '',
    lead_polarity: 'n/a',
    result: 'pass',
    date: new Date().toISOString().slice(0, 10),
    tested_by: '',
    tester_serial: '',
    resulting_expiry_date: '',
    notes: '',
    certificate_url: '',
    certificate_name: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (asset?.compliance_category) {
      const cat = asset.compliance_category.toLowerCase();
      if (cat.includes('lead') || cat.includes('ext')) set('appliance_class', 'extension_lead');
      else if (cat.includes('class 2') || cat.includes('class ii') || cat.includes('double')) set('appliance_class', 'class_II');
      else if (cat.includes('class 3') || cat.includes('class iii') || cat.includes('selv')) set('appliance_class', 'class_III');
    }
  }, [asset]);

  if (!asset) return null;
  const cls = APPLIANCE_CLASSES.find(c => c.value === form.appliance_class);
  const needsEarth = cls?.needs_earth;
  const needsPolarity = form.appliance_class === 'extension_lead';

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Auto-evaluate pass/fail based on readings (KEWPAT thresholds)
  const autoResult = () => {
    if (!form.visual_pass) return 'fail';
    if (needsEarth && form.earth_continuity !== '' && Number(form.earth_continuity) >= 0.1) return 'fail';
    if (form.insulation_resistance !== '') {
      const min = form.appliance_class === 'class_II' ? 2.0 : 1.0;
      if (Number(form.insulation_resistance) < min) return 'fail';
    }
    if (form.load_current !== '' && Number(form.load_current) >= 3.5) return 'fail';
    if (needsPolarity && form.lead_polarity === 'fail') return 'fail';
    return 'pass';
  };

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
      // Resolve expiry date — auto from ComplianceConfig.pat_interval if blank
      let expiryDate = form.resulting_expiry_date || null;
      if (!expiryDate) {
        const cfg = await base44.entities.ComplianceConfig.filter({ key: 'global' });
        const c = cfg[0] || {};
        const interval = Number(c.default_pat_interval_months) || 12;
        const d = new Date(form.date + 'T00:00:00');
        d.setMonth(d.getMonth() + interval);
        expiryDate = d.toISOString().slice(0, 10);
      }
      const computedResult = autoResult();
      const finalResult = form.result === 'pass' && computedResult === 'fail' ? 'fail' : form.result;

      const recordResult = await saveOrQueue('ServiceRecord', 'create', {
        site_asset_id: asset.id,
        record_type: 'pat_inspection',
        date: form.date,
        result: finalResult,
        tested_by: form.tested_by,
        company: 'In-house PAT',
        resulting_expiry_date: finalResult === 'fail' ? null : expiryDate,
        notes: form.notes,
        certificate_url: form.certificate_url || '',
        certificate_name: form.certificate_name || '',
        pat_appliance_class: form.appliance_class,
        pat_visual_pass: form.visual_pass,
        pat_earth_continuity: form.earth_continuity === '' ? null : Number(form.earth_continuity),
        pat_insulation_resistance: form.insulation_resistance === '' ? null : Number(form.insulation_resistance),
        pat_load_current: form.load_current === '' ? null : Number(form.load_current),
        pat_leakage_current: form.leakage_current === '' ? null : Number(form.leakage_current),
        pat_lead_polarity: form.lead_polarity,
        pat_tester_serial: form.tester_serial,
      });

      // If the ServiceRecord was queued offline, don't update the asset yet —
      // the sync will handle consistency on reconnect.
      if (recordResult?._offline) {
        toast({ title: 'Saved offline', description: `${asset.name} PAT record queued — will sync when you reconnect.` });
        if (onSaved) onSaved(asset.name, finalResult);
        onClose();
        return;
      }

      const warnDays = 30;
      const daysUntilExpiry = expiryDate ? Math.floor((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000) : null;
      const status = finalResult === 'fail' ? 'expired'
        : (daysUntilExpiry !== null && daysUntilExpiry < 0) ? 'expired'
        : (daysUntilExpiry !== null && daysUntilExpiry <= warnDays) ? 'expiring'
        : 'compliant';
      await saveOrQueue('SiteAsset', 'update', {
        last_service_date: form.date,
        next_service_date: finalResult === 'fail' ? null : expiryDate,
        compliance_expiry_date: finalResult === 'fail' ? null : expiryDate,
        compliance_status: status,
        compliance_last_checked: new Date().toISOString(),
        is_active: finalResult !== 'fail',
      }, asset.id);

      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['recert-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['pat-session'] });
      toast({
        title: finalResult === 'fail' ? 'PAT test — FAIL' : 'PAT test logged',
        description: `${asset.name} ${finalResult === 'fail' ? 'failed — withdrawn from service' : `passed · next due ${safeFormat(expiryDate, 'dd MMM yyyy')}`}.`,
        variant: finalResult === 'fail' ? 'destructive' : 'default',
      });
      if (onSaved) onSaved(asset.name, finalResult);
      onClose();
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const ResultIcon = form.result === 'fail' ? XCircle : form.result === 'advisory' ? AlertTriangle : CheckCircle2;
  const resultTone = form.result === 'fail' ? 'text-red-600' : form.result === 'advisory' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[100vh] sm:max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
              <Plug className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">PAT Test Record</h3>
              <p className="text-[11px] text-slate-400 truncate">{asset.name} · {asset.equipment_type || asset.compliance_category || 'Portable Appliance'}</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 py-4 space-y-4">
          {/* Appliance Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Appliance Class</label>
            <div className="grid grid-cols-2 gap-2">
              {APPLIANCE_CLASSES.map(c => {
                const active = form.appliance_class === c.value;
                return (
                  <button key={c.value} type="button" onClick={() => set('appliance_class', c.value)}
                    className={`text-left p-2.5 rounded-lg border text-xs transition ${active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="font-semibold text-slate-800 block">{c.label}</span>
                    <span className="text-[10px] text-slate-400">{c.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Inspection */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Visual Inspection</span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => set('visual_pass', true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${form.visual_pass ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                Pass
              </button>
              <button type="button" onClick={() => set('visual_pass', false)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${!form.visual_pass ? 'bg-red-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                Fail
              </button>
            </div>
          </div>

          {/* Electrical Readings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> KEWPAT Readings</p>
            {needsEarth && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1"><Cable className="w-3 h-3" /> Earth Continuity (Ω)</label>
                <input type="number" step="0.01" inputMode="decimal" value={form.earth_continuity}
                  onChange={e => set('earth_continuity', e.target.value)} placeholder="0.00 — pass < 0.1"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1"><Gauge className="w-3 h-3" /> Insulation Resistance (MΩ)</label>
              <input type="number" step="0.01" inputMode="decimal" value={form.insulation_resistance}
                onChange={e => set('insulation_resistance', e.target.value)} placeholder={`pass > ${form.appliance_class === 'class_II' ? '2.0' : '1.0'}`}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Load Current (mA)</label>
                <input type="number" step="0.01" inputMode="decimal" value={form.load_current}
                  onChange={e => set('load_current', e.target.value)} placeholder="pass < 3.5"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Leakage (mA)</label>
                <input type="number" step="0.01" inputMode="decimal" value={form.leakage_current}
                  onChange={e => set('leakage_current', e.target.value)} placeholder="optional"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            {needsPolarity && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Lead Polarity</label>
                <div className="flex gap-1">
                  {['pass', 'fail', 'n/a'].map(p => (
                    <button key={p} type="button" onClick={() => set('lead_polarity', p)}
                      className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition capitalize ${
                        form.lead_polarity === p
                          ? p === 'pass' ? 'bg-emerald-600 text-white' : p === 'fail' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'
                          : 'bg-white text-slate-500 border border-slate-200'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ResultIcon className={`w-5 h-5 ${resultTone}`} />
              <span className="text-sm font-semibold text-slate-700">Overall Result</span>
            </div>
            <div className="flex gap-1">
              {['pass', 'fail', 'advisory'].map(r => (
                <button key={r} type="button" onClick={() => set('result', r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition capitalize ${
                    form.result === r
                      ? r === 'pass' ? 'bg-emerald-600 text-white' : r === 'fail' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                      : 'bg-white text-slate-500 border border-slate-200'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Tester + Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Test Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Next Test Due (auto)</label>
              <input type="date" value={form.resulting_expiry_date} onChange={e => set('resulting_expiry_date', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Tested By</label>
              <input type="text" value={form.tested_by} onChange={e => set('tested_by', e.target.value)} placeholder="Your name"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">KEWPAT Serial</label>
              <input type="text" value={form.tester_serial} onChange={e => set('tester_serial', e.target.value)} placeholder="Tester serial #"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Notes (defects, observations)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>

          {/* Certificate upload */}
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

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 sm:px-5 py-3.5 flex items-center gap-2">
          <button onClick={() => !saving && onClose()} disabled={saving}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60 shadow-sm">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save PAT Record'}
          </button>
        </div>
      </div>
    </div>
  );
}