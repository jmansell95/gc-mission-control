import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Link2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import AGSAutoSyncSection from '@/components/keylogbook/AGSAutoSyncSection';

export default function AGSImportSettings() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-ags-import'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const handleFile = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError('');
  };

  const runImport = async (force = false) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('importAGS', { file, job_id: jobId || null, force });
      setResult(res.data);
      toast({ title: 'AGS data imported', description: `${res.data.inserted} log entries added to ${res.data.job_name}.` });
      setFile(null);
    } catch (err) {
      console.error('AGS import error:', err);
      const errData = err?.response?.data || err?.data || {};
      // Overwrite safeguard: backend returns 409 with needsConfirmation when
      // the new file has far fewer entries than the existing dataset.
      if (errData.needsConfirmation) {
        setConfirmOverwrite({ existingCount: errData.existingCount, newCount: errData.newCount });
      } else {
        setError(errData.error || err?.message || 'Import failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    if (!file) { setError('Please choose an AGS file first.'); return; }
    setConfirmOverwrite(null);
    runImport(false);
  };

  const handleConfirmOverwrite = () => {
    setConfirmOverwrite(null);
    runImport(true);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="KeyLogBook Settings"
        description="KeyLogBook automatically pushes AGS files to Mission Control every 30 minutes — borehole data, strata logs, samples and driller remarks are imported and ready for review. You can also manually upload an AGS export below."
        icon={UploadCloud}
      />

      {/* Automated AGS file push sync (every 30 min) */}
      <AGSAutoSyncSection />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Job selector */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Link2 className="w-4 h-4 text-slate-400" /> Target job (optional)
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Leave blank to auto-match using the job reference number against the AGS <code className="text-slate-600">PROJ_ID</code>. Pick a job manually to override.
          </p>
          <select
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"
          >
            <option value="">Auto-match by job reference</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">AGS export file</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'} ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
              <FileText className={`w-5 h-5 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="text-sm text-slate-600 truncate">
                {file ? file.name : 'Choose .ags file…'}
              </span>
              <input type="file" accept=".ags,.txt,.csv" onChange={handleFile} className="hidden" />
            </label>
            <button
              onClick={handleImport}
              disabled={!file || busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {busy ? 'Importing…' : 'Import AGS data'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Imported {result.inserted} log entries into {result.job_name}
                {result.deleted > 0 && <span className="text-emerald-600 font-normal"> · replaced {result.deleted} previous entries</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-1">
              <ResultStat label="Boreholes" value={result.counts.locations} />
              <ResultStat label="Strata logs" value={result.counts.strata} />
              <ResultStat label="Core runs" value={result.counts.core} />
              <ResultStat label="Samples" value={result.counts.samples} />
              <ResultStat label="SPT tests" value={result.counts.spt} />
              <ResultStat label="Installations" value={result.counts.installations} />
              {result.counts.waterReadings > 0 && (
                <ResultStat label="Water Readings" value={result.counts.waterReadings} />
              )}
              {result.counts.remarks > 0 && (
                <ResultStat label="Site Activities" value={result.counts.remarks} />
              )}
            </div>
            {result.counts.remarks > 0 && (
              <p className="text-xs text-emerald-700 pt-1">
                <span className="font-semibold">{result.counts.remarks}</span> driller activities parsed from remarks — pending review in the Site Logs tab. Approve them to generate the timesheet.
              </p>
            )}
            {result.created_job && (
              <p className="text-xs text-amber-700 pt-1 font-semibold">
                No matching job was found — a new job "{result.job_name}" was created from this AGS file{result.job_reference ? <> (ref: <span className="font-mono">{result.job_reference}</span>)</> : null}.
              </p>
            )}
            {result.job_reference && !result.created_job && (
              <p className="text-xs text-emerald-700 pt-1">Matched job reference: <span className="font-mono font-semibold">{result.job_reference}</span></p>
            )}
            {result.groups && Object.keys(result.groups).length > 0 && (
              <details className="pt-1">
                <summary className="text-xs text-emerald-600 cursor-pointer hover:text-emerald-700 font-medium">
                  AGS groups found ({Object.keys(result.groups).length}) — click to inspect field names
                </summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(result.groups).map(([name, headings]) => (
                    <div key={name} className="text-[11px] text-slate-600">
                      <span className="font-mono font-bold text-slate-800">{name}</span>
                      <span className="text-slate-400">: {headings.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Manual upload section header */}
      <div className="flex items-center gap-2.5 pt-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <UploadCloud className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Manual AGS File Upload</h3>
          <p className="text-xs text-slate-500">Use this to re-import a file, or if the automated sync hasn't been set up yet.</p>
        </div>
      </div>

      {/* Help */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600">Supported AGS blocks:</span> <code>PROJ</code> (job matching),{' '}
          <code>LOCA</code> (borehole locations), <code>GEOL</code>/<code>CHIS</code> (strata descriptions),{' '}
          <code>SAMP</code> (samples), <code>SPT</code>/<code>ISPT</code>/<code>DENS</code> (penetration tests),{' '}
          <code>CORE</code> (rotary core runs with RQD &amp; recovery),{' '}
          <code>TREM</code> (installation pipes),{' '}
          <code>WSTG</code> (standpipe installations &amp; groundwater monitoring readings).{' '}
          If the <code>GEOL</code> group contains RQD or recovery fields, its rows are automatically treated as core runs instead of strata. Tab, comma and
          semicolon-delimited files are auto-detected. Field names are matched by stripping the group prefix
          (e.g. <code>GEOL_TOP_GEOL</code> → <code>TOP</code>) so KeyLogBook's naming variants are all recognised.
          Imported technical logs are marked as non-chargeable and attributed to "AGS Import (KeyLogBook)". They appear in
          the job's Borehole Data Explorer. Re-importing a file only overwrites the boreholes present in that file —
          boreholes not in the file are left untouched, so a full-project upload followed by a single-borehole webhook
          push keeps all boreholes intact.
          <br /><br />
          <span className="font-semibold text-slate-600">Driller remarks:</span> Any time-stamped daily diary text found in <code>*_REM</code>, <code>*_NOTE</code>, or <code>REMARK</code>/<code>DIARY</code> fields
          (e.g. <code>"7:30_8:45 = Start briefing…"</code>) is parsed into individual activities, professionalised, and saved as pending Site Logs —
          identical to the real-time webhook flow. Approve them in the Site Logs tab to generate the timesheet.
        </p>
        </div>

        {/* Overwrite safeguard confirmation dialog */}
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
                but <strong className="text-slate-900">{confirmOverwrite.existingCount}</strong> already exist for this job.
                Re-importing will <span className="text-red-600 font-medium">permanently delete</span> the existing data and replace it with this file's content.
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            This often happens when the AGS export only covers one borehole or one day. Check with the driller if a more complete export is available before proceeding.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setConfirmOverwrite(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
              Cancel
            </button>
            <button onClick={handleConfirmOverwrite}
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

        function ResultStat({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2 text-center">
      <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{value || 0}</p>
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}