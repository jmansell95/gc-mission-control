import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, FileText, Layers, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * AFPUploadModal — upload an AFP Excel file, parse it, preview the extracted
 * data, and commit to the database. Used from the job-level CVR/AFP dashboard.
 */
export default function AFPUploadModal({ job, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState('idle');
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
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res.file_url;
      setFileUrl(url);
      setStage('parsing');
      const parseRes = await base44.functions.invoke('parseAFPUpload', { file_url: url });
      setPreview(parseRes.data?.preview || parseRes.preview);
      setStage('preview');
    } catch (e) {
      setError(e.message || 'Failed to parse AFP');
      setStage('idle');
    }
  };

  const handleCommit = async () => {
    setStage('committing');
    try {
      const res = await base44.functions.invoke('commitAFPParse', {
        job_id: job.id,
        preview,
        source_file_url: fileUrl,
        source_file_name: file?.name || '',
      });
      const data = res.data || res;
      const afpsCreated = data.afps_created || 1;
      toast({
        title: afpsCreated > 1 ? `${afpsCreated} AFPs Imported` : 'AFP Imported',
        description: `${data.total_line_items || data.line_item_count || 0} line items across ${afpsCreated} AFP${afpsCreated > 1 ? 's' : ''}, ${data.variation_count || 0} variations, £${Number(data.total_claimed || 0).toLocaleString()} total claimed.`,
      });
      queryClient.invalidateQueries({ queryKey: ['afp', job.id] });
      queryClient.invalidateQueries({ queryKey: ['afp-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['cvr-portfolio'] });
      setStage('done');
      setTimeout(onClose, 800);
    } catch (e) {
      setError(e.message || 'Failed to commit AFP');
      setStage('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col animate-pop-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Upload AFP</h3>
              <p className="text-[11px] text-slate-400">Application for Payment for {job?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {(stage === 'idle' || stage === 'uploading') && (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Select AFP Excel file</p>
              <p className="text-xs text-slate-400 mb-4">.xlsx format — Valuation Summary, Measured Works, Variation Summary & Materials On site sheets</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="afp-file-input" />
              <label htmlFor="afp-file-input" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer transition active:scale-95">
                <Upload className="w-4 h-4" /> Choose File
              </label>
              {file && <p className="text-xs text-slate-500 mt-3 truncate">{file.name}</p>}
            </div>
          )}

          {stage === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Parsing AFP spreadsheet…</p>
              <p className="text-xs text-slate-400 mt-1">Extracting contract details, measured works, variations & materials</p>
            </div>
          )}

          {stage === 'preview' && preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-semibold">Parsed successfully — review below</p>
              </div>

              {(() => {
                const jobName = (job?.name || '').toLowerCase();
                const isEWR = jobName.includes('ewr') || jobName.includes('east west rail');
                if (!isEWR) return null;
                return (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">EWR job detected</p>
                      <p className="text-xs text-blue-700 mt-0.5">AFP will be built from the EWR template, not the uploaded file. The uploaded file is stored for reference only.</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2.5">
                <PreviewTile label="Contract Value" value={fmt(preview.contract_details?.contract_award_value)} />
                <PreviewTile label="Client PO" value={preview.contract_details?.client_purchase_order || '—'} />
                <PreviewTile label="Client" value={preview.contract_details?.client || '—'} />
                <PreviewTile label="GC Job Number" value={preview.contract_details?.gc_job_number || '—'} />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <CountTile label="Measured Works" count={preview.measured_works?.length || 0} />
                <CountTile label="Variations" count={preview.variations?.length || 0} />
                <CountTile label="Materials" count={preview.materials?.length || 0} />
              </div>

              {(preview.compensation_items?.length || 0) > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  <CountTile label="Compensation Items" count={preview.compensation_items?.length || 0} />
                  <CountTile label="Field Activities" count={preview.field_sheet_activities?.length || 0} />
                </div>
              )}

              {/* Multi-AFP split preview */}
              {preview.afp_split?.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 overflow-hidden">
                  <div className="px-4 py-2 bg-blue-100/60 border-b border-blue-200 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <p className="text-xs font-bold text-blue-700">
                      {preview.afp_split.length} AFP{preview.afp_split.length > 1 ? 's' : ''} will be created from historical data
                    </p>
                  </div>
                  <div className="divide-y divide-blue-100">
                    {preview.afp_split.map((period) => (
                      <div key={period.afp_number} className="px-4 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">AFP {period.afp_number}</span>
                          <span className="text-slate-600 font-medium">
                            {new Date(period.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → {new Date(period.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[10px]">
                          {period.measured_works_lines} MW · {period.variation_lines} VO · {period.compensation_item_lines} CI
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.measured_works?.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">Measured Works Preview (first 5)</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {preview.measured_works.slice(0, 5).map((d, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate">{d.item || '—'}</span>
                        <span className="text-slate-500 font-medium ml-2 flex-shrink-0">{fmt(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {stage === 'committing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Saving AFP data…</p>
            </div>
          )}

          {stage === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-sm font-bold text-slate-900">AFP Imported Successfully</p>
            </div>
          )}
        </div>

        {(stage === 'idle' || stage === 'preview') && (
          <div className="px-5 py-4 border-t border-slate-200 flex gap-2.5 flex-shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition active:scale-95">
              Cancel
            </button>
            {stage === 'idle' && (
              <button onClick={handleUpload} disabled={!file || stage === 'uploading'} className="flex-1 py-2.5 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-40">
                {stage === 'uploading' ? 'Uploading…' : 'Upload & Parse'}
              </button>
            )}
            {stage === 'preview' && (
              <button onClick={handleCommit} className="flex-1 py-2.5 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-sm font-bold transition active:scale-95">
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
      <p className="text-2xl font-bold text-blue-600 tabular-nums">{count}</p>
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}