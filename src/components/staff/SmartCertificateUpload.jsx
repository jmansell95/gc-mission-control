import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload, Loader2, ScanLine, CheckCircle2, X, Sparkles, FileText, RefreshCw,
} from 'lucide-react';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1';

/**
 * Smart certificate/card uploader with AI auto-detection.
 * Uploads a file, scans it with ExtractDataFromUploadedFile to detect the
 * qualification type, title, card number and dates, then lets the user
 * confirm/edit before saving as a ComplianceItem.
 *
 * Props:
 *  - staffId, staffName: the staff member this compliance item belongs to
 *  - categories: TrainingRequirement[] — the valid qualification types
 *  - preselectedCategory: optional category object to default the type
 *  - onSaved: callback after a successful save
 *  - compact: render as a compact button instead of a full panel
 */
export default function SmartCertificateUpload({ staffId, staffName, categories = [], preselectedCategory = null, onSaved, compact = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [stage, setStage] = useState('idle'); // idle | uploading | scanning | review | saving
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [detected, setDetected] = useState(null);

  const [form, setForm] = useState({
    qualification_type: preselectedCategory?.qualification_type || '',
    title: preselectedCategory?.label || '',
    card_number: '',
    issue_date: '',
    expiry_date: '',
  });

  const reset = () => {
    setStage('idle');
    setFileUrl(null);
    setFileName(null);
    setDetected(null);
    setForm({
      qualification_type: preselectedCategory?.qualification_type || '',
      title: preselectedCategory?.label || '',
      card_number: '',
      issue_date: '',
      expiry_date: '',
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage('uploading');
    setDetected(null);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      setFileUrl(uploadRes.file_url);
      setFileName(file.name);

      // Scan the document with AI extraction
      setStage('scanning');
      const qualTypeList = categories.map(c => `${c.qualification_type} (${c.label})`).join(', ');
      const schema = {
        type: 'object',
        properties: {
          qualification_type: {
            type: 'string',
            description: `The qualification type key. Must be one of: ${qualTypeList}. Use "other" if unknown.`,
          },
          title: { type: 'string', description: 'Full title of the certificate or card as printed' },
          card_number: { type: 'string', description: 'Card, registration or certificate number if visible' },
          issue_date: { type: 'string', description: 'Issue date in YYYY-MM format if visible, otherwise blank' },
          expiry_date: { type: 'string', description: 'Expiry or valid-to date in YYYY-MM format if visible, otherwise blank' },
          holder_name: { type: 'string', description: 'Name of the card/certificate holder if visible' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How confident the extraction is' },
        },
      };
      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadRes.file_url,
        json_schema: schema,
      });

      if (extractRes.status === 'success' && extractRes.output) {
        const data = extractRes.output;
        const matchedCat = categories.find(c => c.qualification_type === data.qualification_type);
        setDetected({ ...data, matchedCategory: matchedCat || null });
        setForm({
          qualification_type: data.qualification_type || preselectedCategory?.qualification_type || '',
          title: data.title || matchedCat?.label || preselectedCategory?.label || '',
          card_number: data.card_number || '',
          issue_date: data.issue_date || '',
          expiry_date: data.expiry_date || '',
        });
        setStage('review');
        if (data.qualification_type && matchedCat) {
          toast({ title: `Detected: ${matchedCat.label}`, description: data.holder_name ? `Holder: ${data.holder_name}` : 'Review and confirm the details.' });
        } else {
          toast({ title: 'Document scanned', description: 'Could not auto-detect the type — please select it manually.' });
        }
      } else {
        toast({ title: 'Could not read document', description: extractRes.details || 'Please enter details manually.', variant: 'destructive' });
        setStage('review');
      }
    } catch (err) {
      toast({ title: 'Scan failed', description: err?.message, variant: 'destructive' });
      reset();
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.qualification_type) {
      toast({ title: 'Select a qualification type', variant: 'destructive' });
      return;
    }
    setStage('saving');
    try {
      const cat = categories.find(c => c.qualification_type === form.qualification_type);
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: form.title || cat?.label || 'Certificate',
        qualification_type: form.qualification_type,
        reference_id: staffId,
        reference_name: staffName,
        card_number: form.card_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        document_url: fileUrl,
        document_name: fileName,
        status_override: 'auto',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      toast({ title: 'Certificate saved', description: detected?.holder_name ? `Holder: ${detected.holder_name}` : undefined });
      onSaved?.();
      reset();
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setStage('review');
  };

  const isBusy = stage === 'uploading' || stage === 'scanning' || stage === 'saving';

  // Compact mode — just a button that triggers the file picker
  if (compact) {
    return (
      <>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-50 shadow-sm"
        >
          {stage === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           stage === 'scanning' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           stage === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           <ScanLine className="w-3.5 h-3.5" />}
          {stage === 'uploading' ? 'Uploading…' :
           stage === 'scanning' ? 'Scanning…' :
           stage === 'saving' ? 'Saving…' :
           'Scan Certificate'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
        {stage === 'review' && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <ReviewPanel
                form={form} setForm={setForm} categories={categories}
                detected={detected} fileName={fileName} fileUrl={fileUrl}
                onSave={handleSave} onReset={reset} saving={stage === 'saving'}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />

      {stage === 'idle' && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary hover:bg-primary/5 transition group"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition">
            <ScanLine className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">Scan Certificate / Card</p>
            <p className="text-xs text-slate-400 mt-0.5">Upload a photo or PDF — the system auto-detects the type and details</p>
          </div>
        </button>
      )}

      {(stage === 'uploading' || stage === 'scanning') && (
        <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {stage === 'uploading' ? 'Uploading document…' : 'Scanning with AI…'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {stage === 'uploading' ? 'Sending file to secure storage' : 'Reading qualification type, dates and card number'}
          </p>
        </div>
      )}

      {stage === 'review' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <ReviewPanel
              form={form} setForm={setForm} categories={categories}
              detected={detected} fileName={fileName} fileUrl={fileUrl}
              onSave={handleSave} onReset={reset} saving={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewPanel({ form, setForm, categories, detected, fileName, fileUrl, onSave, onReset, saving }) {
  const confidenceColor = detected?.confidence === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    detected?.confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-slate-900">AI Detected Details</p>
          {detected?.confidence && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
              {detected.confidence} confidence
            </span>
          )}
        </div>
        <button onClick={onReset} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {detected?.holder_name && (
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Detected holder: <strong>{detected.holder_name}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Qualification Type *</label>
          <select value={form.qualification_type} onChange={e => {
            const cat = categories.find(c => c.qualification_type === e.target.value);
            setForm({ ...form, qualification_type: e.target.value, title: form.title || cat?.label || '' });
          }} className={inputClass}>
            <option value="">— Select type —</option>
            {categories.map(c => <option key={c.id} value={c.qualification_type}>{c.label}</option>)}
            <option value="other">Other</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Certificate title" />
        </div>
        <div>
          <label className={labelClass}>Card / Ref Number</label>
          <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} className={inputClass} placeholder="Optional" />
        </div>
        <div>
          <label className={labelClass}>Issue Date</label>
          <input type="month" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expiry Date</label>
          <input type="month" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className={inputClass} />
        </div>
      </div>

      {fileName && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate flex-1">{fileName}</span>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">View</a>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Confirm & Save'}
        </button>
        <button onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
          <RefreshCw className="w-4 h-4" /> Rescan
        </button>
      </div>
    </div>
  );
}