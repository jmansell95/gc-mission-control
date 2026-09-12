import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  IdCard, Award, Car, ShieldCheck, FileText, HardHat, Wrench, GraduationCap,
  Camera, Check, X, ChevronRight, ChevronLeft, Loader2, Sparkles, Upload, RotateCw,
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import ImageCropper from '@/components/ImageCropper';

const DOC_TYPES = [
  { value: 'cscs_card', label: 'CSCS Card', icon: IdCard, requiresFrontBack: true, aspect: 1.586, guide: 'Align card in frame' },
  { value: 'cpcs_card', label: 'CPCS Card', icon: IdCard, requiresFrontBack: true, aspect: 1.586, guide: 'Align card in frame' },
  { value: 'npors_card', label: 'NPORS Card', icon: IdCard, requiresFrontBack: true, aspect: 1.586, guide: 'Align card in frame' },
  { value: 'driver_license', label: 'Driving Licence', icon: Car, requiresFrontBack: true, aspect: 1.586, guide: 'Align licence in frame' },
  { value: 'first_aid_cert', label: 'First Aid Cert', icon: ShieldCheck, requiresFrontBack: false, aspect: 1.414, guide: 'Align certificate in frame' },
  { value: 'dbs_certificate', label: 'DBS Certificate', icon: FileText, requiresFrontBack: false, aspect: 1.414, guide: 'Align certificate in frame' },
  { value: 'forklift', label: 'Forklift Cert', icon: Wrench, requiresFrontBack: false, aspect: 1.414, guide: 'Align certificate in frame' },
  { value: 'other', label: 'Other Certificate', icon: Award, requiresFrontBack: false, aspect: 1.414, guide: 'Align document in frame' },
];

const STEPS = { TYPE: 0, FRONT_CAMERA: 1, FRONT_CROP: 2, BACK_CAMERA: 3, BACK_CROP: 4, EXTRACT: 5, REVIEW: 6 };

const inputClass = 'w-full px-3.5 py-3 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50 transition';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5';

export default function SmartUploadWizard({ staffId, staffName, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(STEPS.TYPE);
  const [docType, setDocType] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontUrl, setFrontUrl] = useState(null);
  const [backUrl, setBackUrl] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', card_number: '', issue_date: '', expiry_date: '', notes: '', location: '' });

  const requiresBack = docType?.requiresFrontBack;

  const uploadFile = async (file) => {
    const res = await base44.integrations.Core.UploadPublicFile({ file });
    return res.file_url;
  };

  const handleFrontCapture = (file) => {
    setFrontFile(file);
    setFrontUrl(URL.createObjectURL(file));
    setStep(STEPS.FRONT_CROP);
  };

  const handleFrontCrop = async (croppedFile) => {
    setFrontFile(croppedFile);
    setFrontUrl(URL.createObjectURL(croppedFile));
    if (requiresBack) {
      setStep(STEPS.BACK_CAMERA);
    } else {
      await runExtraction(croppedFile, null);
    }
  };

  const handleBackCapture = (file) => {
    setBackFile(file);
    setBackUrl(URL.createObjectURL(file));
    setStep(STEPS.BACK_CROP);
  };

  const handleBackCrop = async (croppedFile) => {
    setBackFile(croppedFile);
    setBackUrl(URL.createObjectURL(croppedFile));
    await runExtraction(frontFile, croppedFile);
  };

  const runExtraction = async (fFile, bFile) => {
    setStep(STEPS.EXTRACT);
    setExtracting(true);
    try {
      const [fUrl, bUrl] = await Promise.all([
        uploadFile(fFile),
        bFile ? uploadFile(bFile) : Promise.resolve(null),
      ]);
      const res = await base44.functions.invoke('processStaffUpload', {
        file_url: fUrl,
        back_file_url: bUrl,
        qualification_type: docType.value,
      });
      const extracted = res.data?.extracted || {};
      setForm(prev => ({
        ...prev,
        title: extracted.title || docType.label,
        card_number: extracted.card_number || '',
        issue_date: extracted.issue_date || '',
        expiry_date: extracted.expiry_date || '',
      }));
      // Store uploaded URLs for saving
      setFrontUrl(fUrl);
      if (bUrl) setBackUrl(bUrl);
      setStep(STEPS.REVIEW);
    } catch (err) {
      toast({ title: 'AI read failed', description: 'You can still enter the details manually below.', variant: 'destructive' });
      setForm(prev => ({ ...prev, title: docType.label }));
      setStep(STEPS.REVIEW);
    }
    setExtracting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // If we fell back without extraction, upload now
      let fUrl = frontUrl;
      let bUrl = backUrl;
      if (frontFile && (!fUrl || fUrl.startsWith('blob:'))) {
        fUrl = await uploadFile(frontFile);
      }
      if (backFile && (!bUrl || bUrl.startsWith('blob:'))) {
        bUrl = await uploadFile(backFile);
      }
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: form.title || docType.label,
        qualification_type: docType.value,
        reference_id: staffId,
        reference_name: staffName,
        card_number: form.card_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
        document_url: fUrl,
        document_name: frontFile?.name || 'capture.jpg',
        back_document_url: bUrl || null,
        back_document_name: backFile?.name || null,
        status_override: 'auto',
        review_status: 'pending_review',
        submitter_location: form.location || null,
      });
      queryClient.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      toast({ title: 'Document saved', description: 'Your manager will review it shortly.' });
      onClose();
    } catch (err) {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const reset = () => {
    setStep(STEPS.TYPE);
    setDocType(null);
    setFrontFile(null);
    setBackFile(null);
    setFrontUrl(null);
    setBackUrl(null);
    setForm({ title: '', card_number: '', issue_date: '', expiry_date: '', notes: '', location: '' });
  };

  // === STEP: TYPE SELECTION ===
  if (step === STEPS.TYPE) {
    return (
      <div className="fixed inset-0 z-[65] overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
        <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-lg sm:max-h-[90vh] sm:rounded-3xl sm:shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Add a Document</h2>
                <p className="text-xs text-slate-500">Snap it — AI fills in the rest</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5">
            <p className="text-sm font-medium text-slate-700 mb-3">What are you uploading?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {DOC_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => { setDocType(t); setStep(STEPS.FRONT_CAMERA); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 transition active:scale-95"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 text-center leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === STEP: CAMERA ===
  if (step === STEPS.FRONT_CAMERA || step === STEPS.BACK_CAMERA) {
    const isBack = step === STEPS.BACK_CAMERA;
    return (
      <CameraCapture
        aspect={docType.aspect}
        guideLabel={isBack ? 'Capture BACK of card' : docType.guide}
        onCapture={isBack ? handleBackCapture : handleFrontCapture}
        onCancel={() => setStep(STEPS.TYPE)}
      />
    );
  }

  // === STEP: CROP ===
  if (step === STEPS.FRONT_CROP || step === STEPS.BACK_CROP) {
    const isBack = step === STEPS.BACK_CROP;
    const url = isBack ? backUrl : frontUrl;
    return (
      <ImageCropper
        imageSrc={url}
        aspect={docType.aspect}
        title={isBack ? 'Crop back of card' : 'Crop front of card'}
        onConfirm={isBack ? handleBackCrop : handleFrontCrop}
        onCancel={() => setStep(isBack ? STEPS.BACK_CAMERA : STEPS.FRONT_CAMERA)}
      />
    );
  }

  // === STEP: AI EXTRACTION ===
  if (step === STEPS.EXTRACT) {
    return (
      <div className="fixed inset-0 z-[65] bg-slate-950/60 backdrop-blur-md flex items-center justify-center overflow-y-auto overscroll-contain p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">Reading your {docType.label.toLowerCase()}…</h3>
          <p className="text-sm text-slate-500 mb-5">AI is extracting the details so you don't have to type them.</p>
          <div className="space-y-2.5">
            {['Title', 'Card / ref number', 'Issue date', 'Expiry date'].map((label, i) => (
              <div key={label} className="flex items-center gap-2.5 text-left">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" style={{ animationDelay: `${i * 0.15}s` }} />
                <span className="text-sm text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // === STEP: REVIEW & CONFIRM ===
  if (step === STEPS.REVIEW) {
    return (
      <div className="fixed inset-0 z-[65] overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
        <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-md sm:max-h-[92vh] sm:rounded-3xl sm:shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Check & Save</h2>
                <p className="text-xs text-slate-500">AI filled these in — edit if needed</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Preview thumbnails */}
            <div className={`grid gap-2 ${backUrl ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={frontUrl?.startsWith('blob:') ? frontUrl : frontUrl} alt="Front" className="w-full h-28 object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">Front</span>
              </div>
              {backUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  <img src={backUrl?.startsWith('blob:') ? backUrl : backUrl} alt="Back" className="w-full h-28 object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">Back</span>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Title</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className={inputClass} placeholder="e.g. CSCS Skilled Worker Card" />
            </div>
            <div>
              <label className={labelClass}>Card / Reference Number</label>
              <input type="text" value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })}
                className={inputClass} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Issue Date</label>
                <input type="month" value={form.issue_date || ''} onChange={e => setForm({ ...form, issue_date: e.target.value })}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Expiry Date</label>
                <input type="month" value={form.expiry_date || ''} onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                  className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className={`${inputClass} resize-none`} placeholder="Anything your manager should know" />
            </div>
            <div>
              <label className={labelClass}>Your current location (optional)</label>
              <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className={inputClass} placeholder="e.g. Cambridge North site, Home, Dartford depot" />
              <p className="text-[11px] text-slate-400 mt-1">Tells your manager where you are when uploading — helps them context-check.</p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex gap-2">
            <button onClick={reset} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
              <RotateCw className="w-4 h-4" /> Retake
            </button>
            <button onClick={handleSave} disabled={saving || !form.title}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Document'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}