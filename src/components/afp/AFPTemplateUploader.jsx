import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Upload, FileText, Loader2, CheckCircle2, X, Download,
} from 'lucide-react';

/**
 * AFPTemplateUploader — uploads an AFP Excel template, parses it using the
 * existing parseAFPUpload function, and saves it as an AFPTemplate entity.
 * The template defines the standard line item structure for new AFPs.
 */
export default function AFPTemplateUploader({ onClose }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['afp-templates'],
    queryFn: () => base44.entities.AFPTemplate.filter({}, '-created_date', 20),
  });

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setUploading(false);
      setParsing(true);
      const res = await base44.functions.invoke('parseAFPUpload', { file_url });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      const preview = data.preview || {};
      // Flatten all line items from all sheets
      const allItems = [
        ...(preview.measured_works || []).map(i => ({ ...i, sheet_name: 'measured_works' })),
        ...(preview.variations || []).map(i => ({ ...i, sheet_name: 'variations' })),
        ...(preview.materials || []).map(i => ({ ...i, sheet_name: 'materials' })),
      ];
      setParsedPreview({ file_url, file_name: file.name, items: allItems, contract: preview.contract_details || {} });
      setTemplateName(file.name.replace(/\.(xlsx|xls)$/, ''));
    } catch (e) {
      setError(e.message || 'Failed to parse template');
    }
    setParsing(false);
  };

  const handleSave = async () => {
    if (!parsedPreview || !templateName) return;
    setSaving(true);
    try {
      const lineItems = parsedPreview.items.map((item, i) => ({
        description: item.item || item.description || '',
        unit: item.unit || '',
        unit_price: item.unit_price || item.rate || item.cost || item.price || 0,
        category: item.sheet_name === 'measured_works' ? 'drilling' : item.sheet_name === 'variations' ? 'subcontractor' : item.sheet_name === 'materials' ? 'materials' : 'other',
        sheet_name: item.sheet_name || 'measured_works',
        sort_order: i,
      }));

      await base44.entities.AFPTemplate.create({
        name: templateName,
        line_items: lineItems,
        source_file_url: parsedPreview.file_url,
        source_file_name: parsedPreview.file_name,
        is_active: true,
      });

      queryClient.invalidateQueries({ queryKey: ['afp-templates'] });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save template');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AFP Template</h3>
              <p className="text-[11px] text-white/70">Upload a standard AFP structure for all jobs</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Existing templates */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Existing Templates</p>
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-[10px] text-slate-400">{t.line_items?.length || 0} line items</p>
                  </div>
                  {t.source_file_url && (
                    <a href={t.source_file_url} download className="text-slate-400 hover:text-slate-700">
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload area */}
          {!parsedPreview && (
            <label className="block">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:border-primary hover:bg-green-50/30 transition">
                {uploading || parsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm font-semibold text-slate-600">
                      {uploading ? 'Uploading…' : 'Parsing template…'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Click to upload AFP template</p>
                    <p className="text-xs text-slate-400">Excel file (.xlsx) — headers define the line item structure</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </label>
          )}

          {/* Parsed preview */}
          {parsedPreview && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs text-emerald-800">
                  Parsed {parsedPreview.items.length} line items from {parsedPreview.file_name}
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-slate-500 uppercase text-[10px]">
                      <th className="text-left px-3 py-2 font-semibold">Sheet</th>
                      <th className="text-left px-3 py-2 font-semibold">Description</th>
                      <th className="text-right px-3 py-2 font-semibold">Unit</th>
                      <th className="text-right px-3 py-2 font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {parsedPreview.items.slice(0, 50).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-500">{item.sheet_name}</td>
                        <td className="px-3 py-1.5 text-slate-700 truncate max-w-[200px]">{item.item || item.description}</td>
                        <td className="text-right px-3 py-1.5 text-slate-500">{item.unit || '—'}</td>
                        <td className="text-right px-3 py-1.5 text-slate-700 tabular-nums">£{Number(item.unit_price || item.price || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {parsedPreview && (
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0">
            <button onClick={() => setParsedPreview(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800">Re-upload</button>
            <button
              onClick={handleSave}
              disabled={saving || !templateName}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}