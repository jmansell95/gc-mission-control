import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * AGSUploadButton — fast manual AGS file upload.
 *
 * Uses the same importAGS backend function as the webhook, so data appears
 * identically in the Investigation Hub and Site Activity timeline.
 *
 * Props:
 *  - jobId:  fixed job ID (when embedded on a job's Site Activity tab)
 *  - jobs:   optional job list for the dropdown (when on the Investigation Hub)
 */
export default function AGSUploadButton({ jobId, jobs: jobsProp }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(jobId || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  // Only fetch jobs if we need a dropdown (no fixed jobId)
  const { data: fetchedJobs = [] } = useQuery({
    queryKey: ['jobs-ags-upload'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
    enabled: !jobId && !jobsProp,
  });
  const jobs = jobsProp || fetchedJobs;

  const handleFile = (e) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError('');
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
    queryClient.invalidateQueries({ queryKey: ['investigation-hub-logs'] });
    queryClient.invalidateQueries({ queryKey: ['borehole'] });
  };

  const runImport = async (force = false) => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('importAGS', { file, job_id: selectedJobId || null, force });
      setResult(res.data);
      invalidateAll();
      toast({ title: 'AGS data imported', description: `${res.data.inserted} log entries added to ${res.data.job_name}.` });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      const errData = err?.response?.data || err?.data || {};
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

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setResult(null);
    setError('');
    setConfirmOverwrite(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
      >
        <UploadCloud className="w-3.5 h-3.5" /> Upload AGS
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={handleClose}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-pop-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Upload AGS File</h2>
                  <p className="text-xs text-slate-500">Parsed instantly — same as the webhook</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Job selector (only when no fixed jobId) */}
            {!jobId && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Target job</label>
                <select
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                  disabled={busy}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Auto-match by job reference</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Leave blank to auto-match using the AGS <code>PROJ_ID</code> against job references.</p>
              </div>
            )}

            {/* File picker */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">AGS export file</label>
              <label className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${file ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'} ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                <FileText className={`w-5 h-5 ${file ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-sm text-slate-600 truncate flex-1">
                  {file ? file.name : 'Choose .ags file…'}
                </span>
                <input ref={fileRef} type="file" accept=".ags,.txt,.csv" onChange={handleFile} className="hidden" />
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 space-y-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">
                    Imported {result.inserted} entries into {result.job_name}
                    {result.deleted > 0 && <span className="text-emerald-600 font-normal"> · replaced {result.deleted} previous</span>}
                  </p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <ResultStat label="Boreholes" value={result.counts?.locations} />
                  <ResultStat label="Strata" value={result.counts?.strata} />
                  <ResultStat label="Core" value={result.counts?.core} />
                  <ResultStat label="Samples" value={result.counts?.samples} />
                  <ResultStat label="SPT" value={result.counts?.spt} />
                  <ResultStat label="Install" value={result.counts?.installations} />
                  {result.counts?.remarks > 0 && <ResultStat label="Activities" value={result.counts?.remarks} />}
                </div>
                {result.created_job && (
                  <p className="text-xs text-amber-700 font-semibold">
                    New job "{result.job_name}" created{result.job_reference ? ` (ref: ${result.job_reference})` : ''}.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button onClick={handleClose} disabled={busy} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition disabled:opacity-50">
                {result ? 'Done' : 'Cancel'}
              </button>
              {!result && (
                <button
                  onClick={handleImport}
                  disabled={!file || busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {busy ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overwrite safeguard */}
      {confirmOverwrite && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={() => setConfirmOverwrite(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Replace existing AGS data?</h2>
                <p className="text-sm text-slate-600 mt-1">
                  This file has <strong className="text-slate-900">{confirmOverwrite.newCount}</strong> entries,
                  but <strong className="text-slate-900">{confirmOverwrite.existingCount}</strong> already exist.
                  Re-importing will <span className="text-red-600 font-medium">permanently delete</span> the existing data.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              This often happens when the export only covers one borehole or day. Check with the driller if a more complete export is available.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmOverwrite(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
                Cancel
              </button>
              <button
                onClick={() => { setConfirmOverwrite(null); runImport(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition"
              >
                <UploadCloud className="w-4 h-4" /> Replace & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-emerald-100 px-2 py-1.5 text-center">
      <p className="text-base font-extrabold text-emerald-700 tabular-nums">{value || 0}</p>
      <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}