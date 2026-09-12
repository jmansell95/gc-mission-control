import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, FileBarChart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * CVRUploadModal — upload a CVR Excel file, parse it, preview the extracted
 * data, and commit to the database. Used from the job-level CVR/AFP dashboard.
 */
export default function CVRUploadModal({ job, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState('idle'); // idle | uploading | parsing | preview | committing | done
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setStage('uploading');
    setError('');
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const url = res.file_url;
      setFileUrl(url);
      setStage('parsing');
      const parseRes = await base44.functions.invoke('parseCVRUpload', { file_url: url });
      setPreview(parseRes.data?.preview || parseRes.preview);
      setStage('preview');
    } catch (e) {
      setError(e.message || 'Failed to parse CVR');
      setStage('idle');
    }
  };

  const handleCommit = async () => {
    setStage('committing');
    try {
      const res = await base44.functions.invoke('commitCVRParse', {
        job_id: job.id,
        preview,
        source_file_url: fileUrl,
        source_file_name: file?.name || '',
      });
      const data = res.data || res;
      toast({
        title: 'CVR Imported',
        description: `${data.line_item_count || 0} line items, ${data.variation_count || 0} variations, ${data.cash_flow_count || 0} cash flow entries.`,
      });
      queryClient.invalidateQueries({ queryKey: ['cvr', job.id] });
      queryClient.invalidateQueries({ queryKey: ['cvr-portfolio'] });
      setStage('done');
      setTimeout(onClose, 800);
    } catch (e) {
      setError(e.message || 'Failed to commit CVR');
      setStage('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col animate-pop-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Upload CVR</h3>
              <p className="text-[11px] text-slate-400">Cost/Value Report for {job?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Stage: idle — file picker */}
          {(stage === 'idle' || stage === 'uploading') && (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Select CVR Excel file</p>
              <p className="text-xs text-slate-400 mb-4">.xlsx format — all 5 sheets will be parsed</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="cvr-file-input"
              />
              <label
                htmlFor="cvr-file-input"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer transition active:scale-95"
              >
                <Upload className="w-4 h-4" /> Choose File
              </label>
              {file && (
                <p className="text-xs text-slate-500 mt-3 truncate">{file.name}</p>
              )}
            </div>
          )}

          {/* Stage: parsing — spinner */}
          {stage === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Parsing CVR spreadsheet…</p>
              <p className="text-xs text-slate-400 mt-1">Extracting financial summary, line items, variations & cash flow</p>
            </div>
          )}

          {/* Stage: preview — show parsed data */}
          {stage === 'preview' && preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-semibold">Parsed successfully — review below</p>
              </div>

              {/* Financial summary */}
              <div className="grid grid-cols-2 gap-2.5">
                <PreviewTile label="Contract Value" value={fmt(preview.financial_summary?.contract_value)} />
                <PreviewTile label="Budget" value={fmt(preview.financial_summary?.budget)} />
                <PreviewTile label="Forecast Final" value={fmt(preview.financial_summary?.forecast_final_value)} />
                <PreviewTile label="Weeks in Progress" value={preview.project_plan?.weeks_in_progress || 0} />
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2.5">
                <CountTile label="Line Items" count={preview.line_items?.length || 0} />
                <CountTile label="Variations" count={preview.variation_orders?.length || 0} />
                <CountTile label="Cash Flow Entries" count={preview.cash_flow?.length || 0} />
              </div>

              {/* Line items preview (first 5) */}
              {preview.line_items?.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">Line Items Preview (first 5)</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {preview.line_items.slice(0, 5).map((li, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate">{li.description || '—'}</span>
                        <span className="text-slate-500 font-medium ml-2 flex-shrink-0">{fmt(li.forecast_final_value || li.tender_value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage: committing */}
          {stage === 'committing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Saving CVR data…</p>
            </div>
          )}

          {/* Stage: done */}
          {stage === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-sm font-bold text-slate-900">CVR Imported Successfully</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(stage === 'idle' || stage === 'preview') && (
          <div className="px-5 py-4 border-t border-slate-200 flex gap-2.5 flex-shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition active:scale-95">
              Cancel
            </button>
            {stage === 'idle' && (
              <button
                onClick={handleUpload}
                disabled={!file || stage === 'uploading'}
                className="flex-1 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-40"
              >
                {stage === 'uploading' ? 'Uploading…' : 'Upload & Parse'}
              </button>
            )}
            {stage === 'preview' && (
              <button
                onClick={handleCommit}
                className="flex-1 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95"
              >
                Confirm & Save
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewTile({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function CountTile({ label, count }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
      <p className="text-2xl font-bold text-primary tabular-nums">{count}</p>
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}