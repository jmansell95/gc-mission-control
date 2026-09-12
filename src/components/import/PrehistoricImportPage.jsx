import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  UploadCloud, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2,
  Layers, Database, ShieldCheck, History,
} from 'lucide-react';
import ImportPreviewPane from '@/components/import/ImportPreviewPane';
import ImportProgressModal from '@/components/import/ImportProgressModal';

/**
 * PrehistoricImportPage — Self-isolated full legacy archive import.
 * Upload a legacy Excel/CSV → preview every sheet with auto-matched column→field
 * mapping → review and adjust → confirm → backend takes a backup snapshot then
 * imports in dependency order.
 */
export default function PrehistoricImportPage() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progressModal, setProgressModal] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(null); setError(null); setResult(null); }
  };

  const handleAnalyse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgressModal({
      steps: [{ label: 'Uploading file' }, { label: 'Parsing sheets & headers' }, { label: 'Auto-matching columns to fields' }, { label: 'Building preview' }],
      currentStep: 0, complete: false, title: '', message: '', error: null,
    });
    try {
      const stepTimer = setInterval(() => {
        setProgressModal((prev) => prev && !prev.complete ? { ...prev, currentStep: Math.min(prev.currentStep + 1, prev.steps.length - 1) } : prev);
      }, 3000);
      const res = await base44.functions.invoke('importPrehistoricSnapshot', { file, dry_run: true });
      clearInterval(stepTimer);
      setPreview(res.data);
      setProgressModal((prev) => ({
        ...prev, currentStep: prev.steps.length, complete: true,
        title: 'Preview ready', message: 'Review the field mapping for each sheet, then confirm to import.',
        error: null,
      }));
      setTimeout(() => setProgressModal(null), 1500);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Analysis failed';
      setError(msg);
      setProgressModal((prev) => ({ ...prev, complete: false, error: msg }));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (mappings) => {
    if (!file) return;
    setApplying(true);
    setError(null);
    setProgressModal({
      steps: [
        { label: 'Taking backup snapshot' },
        { label: 'Importing Clients & Teams' },
        { label: 'Importing Staff & Vehicles' },
        { label: 'Importing Jobs' },
        { label: 'Importing Rotas & Timesheets' },
        { label: 'Importing Invoices & Cost Items' },
      ],
      currentStep: 0, complete: false, title: '', message: '', error: null,
    });
    try {
      const stepTimer = setInterval(() => {
        setProgressModal((prev) => prev && !prev.complete ? { ...prev, currentStep: Math.min(prev.currentStep + 1, prev.steps.length - 1) } : prev);
      }, 4000);
      const res = await base44.functions.invoke('importPrehistoricSnapshot', { file, dry_run: false, mappings });
      clearInterval(stepTimer);
      setResult(res.data);
      setPreview(null);
      setProgressModal((prev) => ({
        ...prev, currentStep: prev.steps.length, complete: true,
        title: 'Import complete', message: `Created ${res.data.total_created} records. Backup saved for rollback.`,
        error: null,
      }));
      toast({
        title: 'Prehistoric import complete',
        description: `Created ${res.data.total_created} records across ${Object.keys(res.data.created).filter((k) => res.data.created[k] > 0).length} entities.`,
      });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Import failed';
      setError(msg);
      setProgressModal((prev) => ({ ...prev, complete: false, error: msg }));
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setResult(null); setPreview(null); setFile(null); setError(null); setProgressModal(null);
  };

  return (
    <div className="page-bg-vibrant min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center flex-shrink-0">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Prehistoric Data Import</h2>
            <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
              Import a full legacy archive (Excel/CSV) as a self-isolated snapshot. Every sheet is previewed with auto-matched column→field mapping — review and adjust before confirming. A backup snapshot is taken automatically before any records are written, so the import can be rolled back.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">Auto-backup</p>
              <p className="text-xs text-amber-700">Snapshot taken before commit</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Database className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Full snapshot</p>
              <p className="text-xs text-emerald-700">Clients, Staff, Jobs, Rotas, Invoices…</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Layers className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-900">Dependency order</p>
              <p className="text-xs text-blue-700">Parents imported before children</p>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label className="flex-1 cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center hover:border-amber-500 hover:bg-amber-50/40 transition">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <UploadCloud className="w-6 h-6" />
                  <span className="text-sm">Click to choose a legacy archive file</span>
                </div>
              )}
            </div>
          </label>
          <button
            onClick={handleAnalyse}
            disabled={!file || loading}
            className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition hover:shadow-lg"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><UploadCloud className="w-4 h-4" /> Upload & Preview</>}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* How it works */}
      {!preview && !loading && (
        <div className="hub-glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-3">How it works</h3>
          <ol className="space-y-2.5 text-sm text-slate-600">
            <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">1</span><div><strong>Upload your legacy archive</strong> — Excel or CSV with any number of sheets/tabs.</div></li>
            <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">2</span><div><strong>Review the preview pane</strong> — each sheet's headers are auto-matched to entity fields. Adjust any mapping with the dropdowns.</div></li>
            <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">3</span><div><strong>Confirm</strong> — a backup snapshot of all affected entities is saved first, then records are created in dependency order (Clients → Teams → Staff → Vehicles → Jobs → Rotas → Timesheets → Invoices → Cost Items).</div></li>
            <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">4</span><div><strong>FK resolution</strong> — foreign keys (client_id, staff_id, job_id) are resolved by name against existing and newly-created records.</div></li>
          </ol>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="hub-glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">Import Complete</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{result.total_created}</p>
              <p className="text-xs text-emerald-700">Total Records Created</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-blue-600 tabular-nums">{Object.keys(result.created).filter((k) => result.created[k] > 0).length}</p>
              <p className="text-xs text-blue-700">Entity Types</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 col-span-2">
              <p className="text-xs text-amber-700">Backup snapshot saved</p>
              <p className="text-xs font-mono text-amber-600 truncate mt-0.5">{result.backup_file_uri || '—'}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Records created per entity:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {Object.entries(result.created).map(([entity, count]) => {
                const n = Number(count) || 0;
                if (n === 0) return null;
                return (
                  <div key={entity} className="flex items-center justify-between bg-white rounded px-2.5 py-1.5 text-xs border border-slate-100">
                    <span className="text-slate-600">{entity}</span>
                    <span className="font-bold text-emerald-600">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={handleReset} className="text-sm text-slate-500 hover:text-slate-700">Start new import</button>
        </div>
      )}

      {/* Shared preview pane */}
      {preview && (
        <ImportPreviewPane
          open={!!preview}
          onClose={() => { setPreview(null); setFile(null); }}
          title="Prehistoric Import — Field Matching"
          fileName={file?.name || ''}
          sheets={preview.sheets}
          supportedEntities={preview.supported_entities}
          entitySelectable
          onConfirm={handleConfirm}
          applying={applying}
          confirmLabel="Confirm & Import Snapshot"
        />
      )}

      {/* Progress modal */}
      {progressModal && (
        <ImportProgressModal
          open={!!progressModal}
          steps={progressModal.steps}
          currentStep={progressModal.currentStep}
          complete={progressModal.complete}
          completeTitle={progressModal.title}
          completeMessage={progressModal.message}
          error={progressModal.error}
          onClose={() => setProgressModal(null)}
        />
      )}
    </div>
  );
}