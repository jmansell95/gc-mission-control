import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  GraduationCap, X, Sparkles, Loader2, Check, ChevronRight, AlertTriangle, Calendar, MapPin, Paperclip,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';

const QUICK_REQUESTS = [
  { qualification_type: 'cscs_card', label: 'CSCS Card Renewal', text: 'My CSCS card is expiring and I need a renewal course.' },
  { qualification_type: 'first_aid_cert', label: 'First Aid Renewal', text: 'I need to renew my First Aid at Work certificate.' },
  { qualification_type: 'cpcs_card', label: 'CPCS Renewal', text: 'My CPCS card needs renewing.' },
  { qualification_type: 'npors_card', label: 'NPORS Renewal', text: 'I need to renew my NPORS card.' },
  { qualification_type: 'driver_license', label: 'Driver CPC', text: 'I need Driver CPC training.' },
  { qualification_type: 'other', label: 'Something else', text: '' },
];

const inputClass = 'w-full px-3.5 py-3 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50 transition';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5';

export default function RequestTrainingModal({ staffId, staffName, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [requestText, setRequestText] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [location, setLocation] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Show expiring compliance items so staff can see what needs renewing
  const { data: allItems = [] } = useQuery({
    queryKey: ['staff-compliance', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId,
  });
  const myItems = allItems.filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName));
  const expiring = myItems.filter(i => {
    if (!i.expiry_date) return false;
    const days = complianceDaysUntil(i.expiry_date);
    return days !== null && days <= 60;
  });

  const handleQuickPick = (req) => {
    setSelected(req);
    setRequestText(req.text);
  };

  const handleSubmit = async () => {
    if (!requestText.trim()) {
      toast({ title: 'Tell us what you need', description: 'Type a request or pick a quick option.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // If a certificate document is attached, upload it and create a pending-review
      // ComplianceItem so the manager can confirm it in the Training tab.
      if (attachedFile) {
        try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: attachedFile });
          await base44.entities.ComplianceItem.create({
            category: 'staff',
            title: selected?.label || 'Training Document',
            qualification_type: selected?.qualification_type || 'other',
            reference_id: staffId,
            reference_name: staffName,
            document_url: uploadRes.file_url,
            document_name: attachedFile.name || 'upload',
            notes: requestText || null,
            submitter_location: location || null,
            status_override: 'auto',
            review_status: 'pending_review',
          });
          queryClient.invalidateQueries({ queryKey: ['staff-documents', staffId] });
          queryClient.invalidateQueries({ queryKey: ['pending-training-reviews'] });
        } catch (_) { /* non-blocking — request still goes through */ }
      }
      const res = await base44.functions.invoke('requestStaffTraining', {
        staff_id: staffId,
        staff_name: staffName,
        request_text: location ? `${requestText}\n\nCurrent location: ${location}` : requestText,
        qualification_type: selected?.qualification_type || 'other',
        preferred_date: preferredDate || null,
      });
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['staff-training-history', staffId] });
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
    } catch (err) {
      toast({ title: 'Request failed', description: err?.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-md sm:max-h-[92vh] sm:rounded-3xl sm:shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Request Training</h2>
              <p className="text-xs text-slate-500">AI finds the right course for you</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          /* === SUCCESS VIEW === */
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Training requested!</h3>
            <p className="text-sm text-slate-500 mb-5">Your manager has been notified and will confirm the booking.</p>
            <div className="bg-violet-50 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-violet-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-violet-500 font-medium">Suggested course</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">{result.course.title}</p>
                </div>
              </div>
              {result.course.provider && (
                <p className="text-xs text-slate-500 pl-6">Provider: {result.course.provider}</p>
              )}
              <p className="text-xs text-slate-500 pl-6 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {format(new Date(result.course.start_date + 'T00:00:00'), 'dd MMM yyyy')}
              </p>
            </div>
            <button onClick={onClose}
              className="w-full mt-5 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold shadow-sm">
              Done
            </button>
          </div>
        ) : (
          /* === REQUEST FORM === */
          <div className="p-5 space-y-4">
            {/* Expiring items alert */}
            {expiring.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-amber-700">Expiring soon</p>
                </div>
                <div className="space-y-1.5">
                  {expiring.map(item => {
                    const days = complianceDaysUntil(item.expiry_date);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleQuickPick({
                          qualification_type: item.qualification_type || 'other',
                          label: `Renew ${item.title}`,
                          text: `I need to renew my ${item.title}. It expires on ${item.expiry_date}.`,
                        })}
                        className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition"
                      >
                        <span className="text-xs font-medium text-slate-700 truncate">{item.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {days < 0 ? 'Expired' : `${days}d left`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick picks */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">What do you need?</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_REQUESTS.map(req => {
                  const isActive = selected?.label === req.label;
                  return (
                    <button
                      key={req.label}
                      onClick={() => handleQuickPick(req)}
                      className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition active:scale-95 ${
                        isActive
                          ? 'border-violet-400 bg-violet-50 text-violet-700'
                          : 'border-slate-100 text-slate-600 hover:border-violet-200'
                      }`}
                    >
                      {req.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free text */}
            <div>
              <label className={labelClass}>Describe what you need</label>
              <textarea
                value={requestText}
                onChange={e => setRequestText(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="e.g. I need a CSCS renewal course, preferably in September"
              />
            </div>

            {/* Preferred date */}
            <div>
              <label className={labelClass}>Preferred date (optional)</label>
              <input
                type="date"
                value={preferredDate}
                onChange={e => setPreferredDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className={inputClass}
              />
            </div>

            {/* Current location */}
            <div>
              <label className={labelClass}>Your current location (optional)</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputClass}
                placeholder="e.g. Cambridge North site, Home, Dartford depot"
              />
            </div>

            {/* Optional certificate attachment */}
            <div>
              <label className={labelClass}>Attach a certificate (optional)</label>
              <label className="flex items-center gap-2 px-3.5 py-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition">
                <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-600 truncate flex-1">
                  {attachedFile ? attachedFile.name : 'Attach a scan or photo of your certificate'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setAttachedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">If you attach a document it's saved immediately but stays "pending review" until your manager confirms it.</p>
            </div>

            {/* AI hint */}
            <div className="flex items-start gap-2 bg-violet-50 rounded-xl p-3">
              <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-violet-700 leading-relaxed">
                AI will suggest the best course, provider and date. Your manager gets notified to confirm.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !requestText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 active:scale-95 transition text-sm font-semibold disabled:opacity-50 shadow-sm"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Finding your course…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Request with AI</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}