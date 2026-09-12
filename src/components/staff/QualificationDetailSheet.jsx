import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle2, AlertTriangle, Clock, XCircle, Calendar, FileText,
  Plus, Trash2, GraduationCap, Loader2, ExternalLink, ScanLine, X, Upload,
} from 'lucide-react';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import SmartCertificateUpload from '@/components/staff/SmartCertificateUpload';

function statusInfo(item) {
  if (item.status_override === 'missing') return { label: 'Missing', Icon: XCircle, cls: 'text-red-600 bg-red-50' };
  if (item.status_override === 'not_required') return { label: 'N/A', Icon: CheckCircle2, cls: 'text-slate-400 bg-slate-50' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { label: 'No Expiry', Icon: FileText, cls: 'text-slate-400 bg-slate-50' };
  if (days < 0) return { label: 'Expired', Icon: XCircle, cls: 'text-red-600 bg-red-50' };
  if (days <= 30) return { label: `${days}d left`, Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' };
  return { label: 'Valid', Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' };
}

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

export default function QualificationDetailSheet({
  open, onOpenChange, staff, category, allCategories = [], complianceItems, bookings, courses, onBookTraining,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: category?.label || '', card_number: '', issue_date: '', expiry_date: '' });
  const [docUrl, setDocUrl] = useState(null);
  const [docName, setDocName] = useState(null);
  const fileRef = useRef(null);

  // Lock body scroll when the sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!staff || !category) return null;

  const items = complianceItems.filter(c =>
    (c.reference_id === staff.id || c.reference_name === staff.name) &&
    c.qualification_type === category.qualification_type
  );
  const staffBookings = bookings.filter(b => b.staff_id === staff.id);
  const categoryBookings = staffBookings.filter(b => {
    const course = courses.find(c => c.id === b.course_id);
    return course?.category === category.qualification_type;
  });

  const resetForm = () => {
    setForm({ title: category.label, card_number: '', issue_date: '', expiry_date: '' });
    setDocUrl(null);
    setDocName(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setDocUrl(res.file_url);
      setDocName(file.name);
      toast({ title: 'File uploaded', description: file.name });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: form.title || category.label,
        qualification_type: category.qualification_type,
        reference_id: staff.id,
        reference_name: staff.name,
        card_number: form.card_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        document_url: docUrl,
        document_name: docName,
        status_override: 'auto',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Compliance item added' });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      toast({ title: 'Could not add', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await base44.entities.ComplianceItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Item deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkMissing = async () => {
    setSaving(true);
    try {
      await base44.entities.ComplianceItem.create({
        category: 'staff',
        title: category.label,
        qualification_type: category.qualification_type,
        reference_id: staff.id,
        reference_name: staff.name,
        status_override: 'missing',
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      toast({ title: 'Marked as missing' });
    } catch (err) {
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Custom Sheet — no Radix focus trap, so popups are fully interactive */}
      <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 grid w-full p-4 pt-14 overflow-y-auto overscroll-contain max-h-[100dvh] sm:left-[50%] sm:top-[50%] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:p-6 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.25)]">
        <button onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 rounded-xl p-2 bg-slate-100/80 text-slate-500 transition-all hover:scale-110 hover:bg-slate-200 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{staff.name}</h2>
            <p className="text-sm text-slate-500">{category.label} · {category.short_code}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowScan(true); setShowAdd(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition shadow-sm">
              <ScanLine className="w-3.5 h-3.5" /> Scan & Auto-Fill
            </button>
            <button onClick={() => { setShowAdd(true); setShowScan(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/5 transition">
              <Plus className="w-3.5 h-3.5" /> Add Manually
            </button>
            <button onClick={handleMarkMissing} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition border border-red-200">
              <XCircle className="w-3.5 h-3.5" /> Mark Missing
            </button>
            <button onClick={() => onBookTraining([staff.id], category.qualification_type)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition border border-blue-200">
              <Calendar className="w-3.5 h-3.5" /> Book Training
            </button>
          </div>

          {/* Existing compliance items */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Compliance Records</p>
            {items.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">No records yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => {
                  const st = statusInfo(item);
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${st.cls}`}>
                        <st.Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{st.label}</span>
                          {item.card_number && <span>· #{item.card_number}</span>}
                          {item.expiry_date && <span>· exp {formatComplianceDate(item.expiry_date)}</span>}
                          {item.document_url && (
                            <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline">
                              <ExternalLink className="w-2.5 h-2.5" /> doc
                            </a>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(item)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bookings */}
          {categoryBookings.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Training Bookings</p>
              <div className="space-y-2">
                {categoryBookings.map(b => {
                  const course = courses.find(c => c.id === b.course_id);
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{course?.title || 'Course'}</p>
                        <p className="text-[10px] text-slate-400">Status: {b.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan popup — sibling of the sheet, no focus trap interference */}
      {showScan && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => setShowScan(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Scan Certificate</h3>
              <button onClick={() => setShowScan(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <SmartCertificateUpload
              staffId={staff.id}
              staffName={staff.name}
              categories={allCategories && allCategories.length > 0 ? allCategories : (category ? [category] : [])}
              preselectedCategory={category}
              onSaved={() => { setShowScan(false); onOpenChange(false); }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Add manually popup — sibling of the sheet, no focus trap interference */}
      {showAdd && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => { setShowAdd(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Add Compliance Item</h3>
              <button onClick={() => { setShowAdd(false); resetForm(); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Card / Ref</label>
                  <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Issue (YYYY-MM)</label>
                  <input type="month" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry (YYYY-MM)</label>
                  <input type="month" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className={inputClass} />
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Document / Certificate File</label>
                <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-[#1c4a12] file:cursor-pointer cursor-pointer" />
                {uploading && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                  </div>
                )}
                {docName && !uploading && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate flex-1">{docName}</span>
                    {docUrl && (
                      <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">View</a>
                    )}
                    <button type="button" onClick={() => { setDocUrl(null); setDocName(null); }} className="text-slate-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving || uploading}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
}