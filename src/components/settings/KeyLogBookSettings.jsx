import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileUp, Loader2, Check, AlertTriangle, UploadCloud, FileText, Database,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import AGSAutoSyncSection from '@/components/keylogbook/AGSAutoSyncSection';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';

/**
 * KeyLogBook — dedicated integration page for AGS & borehole data sync.
 * Split out from the old combined GeotechSettings so each integration has its
 * own clean page (per the settings restructure). Shows webhook/auto-sync
 * config plus manual AGS upload with overwrite safeguard.
 */
export default function KeyLogBookSettings() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-keylogbook'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const handleFile = (e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); };

  const runImport = async (force = false) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await base44.functions.invoke('importAGS', { file, job_id: jobId || null, force });
      setResult(res.data);
      toast({ title: 'AGS data imported', description: `${res.data.inserted} log entries added to ${res.data.job_name}.` });
      setFile(null);
    } catch (err) {
      const errData = err?.response?.data || err?.data || {};
      if (errData.needsConfirmation) {
        setConfirmOverwrite({ existingCount: errData.existingCount, newCount: errData.newCount });
      } else {
        setError(errData.error || err?.message || 'Import failed');
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="KeyLogBook"
        description="One webhook handles borehole data AND driller remarks/diary. Configure the endpoint, auth, and signing below."
        icon={FileUp}
      />

      {/* KeyLogBook webhook — borehole data AND driller remarks/diary via one endpoint */}
      <AGSAutoSyncSection />

      {/* Manual AGS upload */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Manual AGS Upload</h3>
          <span className="text-xs text-slate-400">— re-import a file or upload if auto-sync isn't set up</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" /> Target job (optional)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">Leave blank to auto-match by job reference against the AGS <code className="text-slate-600">PROJ_ID</code>.</p>
          <select value={jobId} onChange={e => setJobId(e.target.value)} disabled={busy}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
            <option value="">Auto-match by job reference</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}</option>)}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'} ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <FileText className={`w-5 h-5 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-600 truncate">{file ? file.name : 'Choose .ags file…'}</span>
            <input type="file" accept=".ags,.txt,.csv" onChange={handleFile} className="hidden" />
          </label>
          <button onClick={() => { setConfirmOverwrite(null); runImport(false); }} disabled={!file || busy}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {busy ? 'Importing…' : 'Import AGS data'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Imported {result.inserted} log entries into {result.job_name}
                {result.deleted > 0 && <span className="text-emerald-600 font-normal"> · replaced {result.deleted} previous entries</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
              {[
                { label: 'Boreholes', value: result.counts?.locations },
                { label: 'Strata', value: result.counts?.strata },
                { label: 'Core', value: result.counts?.core },
                { label: 'Samples', value: result.counts?.samples },
                { label: 'SPT', value: result.counts?.spt },
                { label: 'Installations', value: result.counts?.installations },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg border border-emerald-100 px-2.5 py-2 text-center">
                  <p className="text-base font-extrabold text-emerald-700 tabular-nums">{s.value || 0}</p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            {result.counts?.remarks > 0 && (
              <p className="text-xs text-emerald-700 pt-1">
                <span className="font-semibold">{result.counts.remarks}</span> driller activities parsed — pending review in Site Logs.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Overwrite safeguard */}
      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Replace existing AGS data?</h2>
                <p className="text-sm text-slate-600 mt-1">
                  This file contains <strong className="text-slate-900">{confirmOverwrite.newCount}</strong> entries,
                  but <strong className="text-slate-900">{confirmOverwrite.existingCount}</strong> already exist for these boreholes.
                  Re-importing will <span className="text-red-600 font-medium">permanently delete</span> the existing data and replace it.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              This often happens when the AGS export only covers one borehole or one day. Check with the driller if a more complete export is available.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmOverwrite(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={() => { setConfirmOverwrite(null); runImport(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition">
                <UploadCloud className="w-4 h-4" /> Replace & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}