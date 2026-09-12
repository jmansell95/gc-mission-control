import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle2, XCircle, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function TrainingOutcomeModal({ booking, course, staff, courses = [], onClose }) {
  const [outcome, setOutcome] = useState(null); // 'passed' | 'failed'
  const [certificateTitle, setCertificateTitle] = useState(course?.title || '');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM'));
  const [expiryDate, setExpiryDate] = useState('');
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificateUrl, setCertificateUrl] = useState(booking?.certificate_url || '');
  const [certificateName, setCertificateName] = useState(booking?.certificate_name || '');
  const [failureReason, setFailureReason] = useState('');
  const [rebookCourseId, setRebookCourseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const futureCourses = courses.filter(c => c.id !== course?.id && new Date(c.start_date + 'T00:00:00') >= new Date());

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setCertificateUrl(file_url);
      setCertificateName(file.name);
      setCertificateFile(file);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const calculateExpiry = (months) => {
    if (!months) return '';
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return format(d, 'yyyy-MM');
  };

  const handleSubmit = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      if (outcome === 'passed') {
        if (!certificateUrl) {
          toast({ title: 'Certificate required', description: 'Please upload the certificate to record a pass.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        // Create compliance item
        const complianceItem = await base44.entities.ComplianceItem.create({
          category: 'staff',
          title: certificateTitle || course?.title || 'Training Certificate',
          qualification_type: course?.category || 'other',
          reference_name: booking?.staff_name || staff?.name || '',
          reference_id: booking?.staff_id || staff?.id || '',
          document_url: certificateUrl,
          document_name: certificateName,
          issue_date: issueDate,
          expiry_date: expiryDate || undefined,
          status_override: 'auto'
        });
        // Update booking
        await base44.entities.TrainingBooking.update(booking.id, {
          status: 'passed',
          certificate_url: certificateUrl,
          certificate_name: certificateName,
          certificate_title: certificateTitle,
          issue_date: issueDate,
          expiry_date: expiryDate || undefined,
          linked_compliance_id: complianceItem.id,
          completed_at: new Date().toISOString()
        });
        toast({ title: 'Training completed', description: `${booking.staff_name} passed. Certificate added to their compliance wallet.` });
      } else {
        // Failed
        if (!failureReason.trim()) {
          toast({ title: 'Reason required', description: 'Please enter a reason for the failure.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        await base44.entities.TrainingBooking.update(booking.id, {
          status: 'failed',
          failure_reason: failureReason,
          completed_at: new Date().toISOString()
        });
        // Rebook if selected
        if (rebookCourseId) {
          const newBooking = await base44.entities.TrainingBooking.create({
            course_id: rebookCourseId,
            staff_id: booking.staff_id,
            staff_name: booking.staff_name,
            status: 'booked'
          });
          await base44.entities.TrainingBooking.update(booking.id, { rebooked_course_id: rebookCourseId });
          try { await base44.functions.invoke('notifyTrainingBooking', { booking_id: newBooking.id }); } catch (_) {}
          toast({ title: 'Failed & rebooked', description: `${booking.staff_name} has been rebooked onto a new course.` });
        } else {
          toast({ title: 'Marked as failed', description: 'You can rebook them from the course page later.' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance'] });
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Training Outcome</h3>
            <p className="text-sm text-slate-500">{booking?.staff_name} · {course?.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Outcome selection */}
          {!outcome && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setOutcome('passed')} type="button"
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition active:scale-95">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                <span className="font-bold text-emerald-900">Passed</span>
                <span className="text-xs text-emerald-600 text-center">Upload certificate & add to compliance</span>
              </button>
              <button onClick={() => setOutcome('failed')} type="button"
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition active:scale-95">
                <XCircle className="w-10 h-10 text-red-500" />
                <span className="font-bold text-red-900">Failed</span>
                <span className="text-xs text-red-500 text-center">Record reason & optionally rebook</span>
              </button>
            </div>
          )}

          {/* Pass form */}
          {outcome === 'passed' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" /> Record pass and upload certificate
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Certificate Name *</label>
                <input type="text" value={certificateTitle} onChange={e => setCertificateTitle(e.target.value)} placeholder="e.g. Forklift Operator Certificate"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Upload Certificate *</label>
                {certificateUrl ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                    <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-emerald-700 truncate flex-1">{certificateName}</span>
                    <button onClick={() => { setCertificateUrl(''); setCertificateName(''); }} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 transition ${uploading ? 'opacity-50' : ''}`}>
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-500">{uploading ? 'Uploading…' : 'Click to upload certificate'}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFileUpload(e.target.files[0])} disabled={uploading} />
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Issue Date *</label>
                  <input type="month" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                  <input type="month" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  {course?.default_expiry_months && !expiryDate && (
                    <button type="button" onClick={() => setExpiryDate(calculateExpiry(course.default_expiry_months))}
                      className="text-xs text-emerald-700 hover:underline mt-1">Auto-fill ({course.default_expiry_months}m)</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fail form */}
          {outcome === 'failed' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4" /> Record failure and optionally rebook
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason for Failure *</label>
                <textarea value={failureReason} onChange={e => setFailureReason(e.target.value)} rows={3} placeholder="e.g. Did not pass the practical assessment"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rebook onto another course?</label>
                <select value={rebookCourseId} onChange={e => setRebookCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  <option value="">Don't rebook now</option>
                  {futureCourses.map(c => <option key={c.id} value={c.id}>{c.title} — {format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy')}</option>)}
                </select>
                {futureCourses.length === 0 && rebookCourseId === '' && (
                  <p className="text-xs text-slate-400 mt-1">No upcoming courses to rebook onto. You can rebook later from the training page.</p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {outcome && (
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving…' : outcome === 'passed' ? 'Record Pass & Save Certificate' : 'Record Failure' + (rebookCourseId ? ' & Rebook' : '')}
              </button>
              <button onClick={() => setOutcome(null)} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition text-sm font-medium">Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}