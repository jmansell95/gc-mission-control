import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  X, GraduationCap, Calendar, MapPin, Building2, Award, Upload, Loader2,
  CheckCircle2, FileText, Clock,
} from 'lucide-react';
import { format } from 'date-fns';

const RESULT_OPTIONS = [
  { value: 'passed', label: 'Passed', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'attended', label: 'Attended', cls: 'bg-blue-100 text-blue-700' },
  { value: 'failed', label: 'Failed', cls: 'bg-red-100 text-red-700' },
];

/**
 * AddCompletedTrainingModal — popup for recording training a crew member
 * has already completed (date, place, provider, result, optional cert).
 * Creates a TrainingBooking (status passed/attended) AND auto-creates the
 * matching ComplianceItem so the matrix updates instantly.
 */
export default function AddCompletedTrainingModal({ staffId, staffName, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    qualification_type: '',
    course_title: '',
    completed_date: '',
    venue: '',
    provider_id: '',
    result: 'passed',
    expiry_date: '',
    certificate_url: '',
    certificate_name: '',
    back_certificate_url: '',
    back_certificate_name: '',
  });
  const [uploadingSide, setUploadingSide] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: requirements = [] } = useQuery({
    queryKey: ['training-requirements'],
    queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100),
  });
  const { data: providers = [] } = useQuery({
    queryKey: ['training-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }),
  });

  const categories = useMemo(() =>
    requirements.filter(r => r.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  [requirements]);

  // Smart-linked providers: only show training providers whose services match
  // the selected category. Falls back to all providers when no category set.
  const filteredProviders = useMemo(() => {
    if (!form.qualification_type) return providers;
    return providers.filter(p => p.training_services?.includes(form.qualification_type));
  }, [providers, form.qualification_type]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const selectedCat = categories.find(c => c.qualification_type === form.qualification_type);
  const isCardType = !!(selectedCat?.requires_front_back || selectedCat?.is_card);

  const handleCategoryChange = (val) => {
    setForm(prev => {
      const matching = val ? providers.filter(p => p.training_services?.includes(val)) : providers;
      const providerStillValid = matching.some(p => p.id === prev.provider_id);
      const newCat = val ? requirements.find(r => r.qualification_type === val) : null;
      const newIsCard = !!(newCat?.requires_front_back || newCat?.is_card);
      return {
        ...prev,
        qualification_type: val,
        provider_id: providerStillValid ? prev.provider_id : '',
        back_certificate_url: newIsCard ? prev.back_certificate_url : '',
        back_certificate_name: newIsCard ? prev.back_certificate_name : '',
      };
    });
  };

  const handleFile = async (file, side) => {
    if (!file) return;
    setUploadingSide(side);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (side === 'back') {
        setForm(prev => ({ ...prev, back_certificate_url: res.file_url, back_certificate_name: file.name }));
      } else {
        setForm(prev => ({ ...prev, certificate_url: res.file_url, certificate_name: file.name }));
      }
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    }
    setUploadingSide(null);
  };

  const handleSave = async () => {
    if (!form.qualification_type || !form.expiry_date) {
      toast({ title: 'Category and expiry date are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find(c => c.qualification_type === form.qualification_type);
      const provider = providers.find(p => p.id === form.provider_id);
      const title = form.course_title || cat?.label || 'Completed Training';

      // 1. Create the TrainingBooking record
      await base44.entities.TrainingBooking.create({
        staff_id: staffId,
        staff_name: staffName || '',
        status: form.result,
        certificate_url: form.certificate_url || '',
        certificate_name: form.certificate_name || '',
        certificate_title: title,
        issue_date: form.completed_date,
        expiry_date: form.expiry_date || '',
        notes: [form.venue && `Venue: ${form.venue}`, provider && `Provider: ${provider.name}`].filter(Boolean).join('\n'),
        completed_at: new Date().toISOString(),
      });

      // 2. Auto-create the matching ComplianceItem
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        qualification_type: form.qualification_type,
        reference_id: staffId,
        reference_name: staffName || '',
        title: cat?.label || title,
        issue_date: form.completed_date,
        expiry_date: form.expiry_date || '',
        document_url: form.certificate_url || '',
        document_name: form.certificate_name || '',
        back_document_url: form.back_certificate_url || '',
        back_document_name: form.back_certificate_name || '',
        review_status: 'approved',
        status_override: 'auto',
        responsible_person: staffName || '',
      });

      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-training-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-compliance'] });
      toast({ title: 'Training recorded', description: `${title} added for ${staffName || 'this crew member'} — compliance certificate created.` });
      onClose();
    } catch (e) {
      toast({ title: 'Could not save training', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-lg sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base">Add Completed Training</h3>
              <p className="text-xs text-white/70 truncate">{staffName || 'Crew member'} · records history + certificate</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Category + Course title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category *</label>
              <select value={form.qualification_type} onChange={e => handleCategoryChange(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.qualification_type}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Course Title</label>
              <input value={form.course_title} onChange={e => set('course_title', e.target.value)} placeholder="e.g. NVQ Level 2" className={inputCls} />
            </div>
          </div>

          {/* Date + Result */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date Completed</label>
              <input type="date" value={form.completed_date} onChange={e => set('completed_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Result</label>
              <div className="flex gap-1.5">
                {RESULT_OPTIONS.map(r => (
                  <button key={r.value} type="button" onClick={() => set('result', r.value)}
                    className={'flex-1 px-2 py-2.5 rounded-lg text-xs font-bold transition ' +
                      (form.result === r.value ? r.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Venue + Provider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Venue / Place</label>
              <input value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="e.g. CITB Cambridge" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provider</label>
              <select value={form.provider_id} onChange={e => set('provider_id', e.target.value)} className={inputCls}>
                <option value="">{form.qualification_type && filteredProviders.length === 0 ? 'No matching provider' : 'None'}</option>
                {filteredProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className={labelCls}>Expiry Date *</label>
            <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className={inputCls} />
          </div>

          {/* Certificate / card upload */}
          {isCardType ? (
            <div>
              <label className={labelCls}>Card Photos (front & back)</label>
              <div className="grid grid-cols-2 gap-3">
                <CardUploadTile label="Front of Card" fileUrl={form.certificate_url} fileName={form.certificate_name} uploading={uploadingSide === 'front'} onFile={(f) => handleFile(f, 'front')} />
                <CardUploadTile label="Back of Card" fileUrl={form.back_certificate_url} fileName={form.back_certificate_name} uploading={uploadingSide === 'back'} onFile={(f) => handleFile(f, 'back')} />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Certificate (optional)</label>
              <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => handleFile(e.target.files?.[0], 'front')} />
                {uploadingSide === 'front' ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Upload className="w-5 h-5 text-slate-400" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{form.certificate_name || 'Upload certificate / card photo'}</p>
                  <p className="text-[10px] text-slate-400">Image or PDF · auto-creates compliance record</p>
                </div>
                {form.certificate_url && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            <button onClick={handleSave} disabled={saving || !!uploadingSide}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Record Training'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardUploadTile({ label, fileUrl, fileName, uploading, onFile }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</span>
      <label className="flex flex-col items-center gap-1.5 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition h-full min-h-[120px] justify-center">
        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => onFile(e.target.files?.[0])} />
        {uploading ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : fileUrl ? (
          fileUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
            <img src={fileUrl} alt={fileName} className="w-full h-16 object-cover rounded-md" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          )
        ) : (
          <Upload className="w-5 h-5 text-slate-300" />
        )}
        <p className="text-[10px] text-slate-500 truncate w-full text-center">{fileName || 'Upload'}</p>
        {fileUrl && <span className="text-[9px] text-primary font-semibold">Replace</span>}
      </label>
    </label>
  );
}