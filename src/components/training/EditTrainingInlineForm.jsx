import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, CheckCircle2, Upload, Trash2, AlertTriangle,
} from 'lucide-react';

const RESULT_OPTIONS = [
  { value: 'passed', label: 'Passed' },
  { value: 'attended', label: 'Attended' },
  { value: 'failed', label: 'Failed' },
  { value: 'booked', label: 'Booked' },
  { value: 'rebooked', label: 'Rebooked' },
];

const parseNote = (notes, prefix) => {
  const line = (notes || '').split('\n').find(l => l.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

/**
 * EditTrainingInlineForm — inline edit form rendered inside the staff
 * training drawer. Edits a ComplianceItem (dates + files) and its linked
 * TrainingBooking (date, result, venue, provider, certificate) together.
 * Supports delete of both records. When only a booking is provided (no
 * compliance item — e.g. an upcoming booked course), edits status + details
 * and deletes the booking alone.
 */
export default function EditTrainingInlineForm({ complianceItem, booking, category, staffId, staffName, onDone }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    issue_date: complianceItem?.issue_date || booking?.issue_date || '',
    expiry_date: complianceItem?.expiry_date || booking?.expiry_date || '',
    result: booking?.status || 'passed',
    venue: booking ? parseNote(booking.notes, 'Venue:') : '',
    provider_id: '',
    front_url: complianceItem?.document_url || booking?.certificate_url || '',
    front_name: complianceItem?.document_name || booking?.certificate_name || '',
    back_url: complianceItem?.back_document_url || '',
    back_name: complianceItem?.back_document_name || '',
  });
  const [uploadingSide, setUploadingSide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCardType = !!(category?.requires_front_back || category?.is_card);
  const hasCompliance = !!complianceItem;

  const { data: providers = [] } = useQuery({
    queryKey: ['training-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }),
  });

  // Resolve provider from booking notes once providers load
  useEffect(() => {
    if (booking) {
      const providerName = parseNote(booking.notes, 'Provider:');
      if (providerName) {
        const p = providers.find(p => p.name === providerName);
        if (p) setForm(prev => ({ ...prev, provider_id: p.id }));
      }
    }
  }, [providers, booking]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFile = async (file, side) => {
    if (!file) return;
    setUploadingSide(side);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (side === 'back') {
        setForm(prev => ({ ...prev, back_url: res.file_url, back_name: file.name }));
      } else {
        setForm(prev => ({ ...prev, front_url: res.file_url, front_name: file.name }));
      }
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    }
    setUploadingSide(null);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
    queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['staff-training-history'] });
    queryClient.invalidateQueries({ queryKey: ['my-compliance'] });
  };

  const handleSave = async () => {
    if (!form.issue_date) {
      toast({ title: 'Date is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const provider = providers.find(p => p.id === form.provider_id);
      if (complianceItem) {
        await base44.entities.ComplianceItem.update(complianceItem.id, {
          issue_date: form.issue_date,
          expiry_date: form.expiry_date || '',
          document_url: form.front_url || '',
          document_name: form.front_name || '',
          back_document_url: isCardType ? (form.back_url || '') : '',
          back_document_name: isCardType ? (form.back_name || '') : '',
        });
      }
      if (booking) {
        await base44.entities.TrainingBooking.update(booking.id, {
          issue_date: form.issue_date,
          expiry_date: form.expiry_date || '',
          status: form.result,
          certificate_url: form.front_url || '',
          certificate_name: form.front_name || '',
          notes: [form.venue && `Venue: ${form.venue}`, provider && `Provider: ${provider.name}`].filter(Boolean).join('\n'),
        });
      }
      invalidateAll();
      toast({ title: 'Training updated' });
      onDone();
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      if (booking) await base44.entities.TrainingBooking.delete(booking.id);
      if (complianceItem) await base44.entities.ComplianceItem.delete(complianceItem.id);
      invalidateAll();
      toast({ title: 'Training record deleted' });
      onDone();
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';
  const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

  return (
    <div className="rounded-xl border border-[#2E5A1A]/20 bg-[#2E5A1A]/5 p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Expiry</label>
          <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className={inputCls} />
        </div>
      </div>

      {booking && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Result</label>
            <select value={form.result} onChange={e => set('result', e.target.value)} className={inputCls}>
              {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Venue</label>
            <input value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="e.g. CITB Cambridge" className={inputCls} />
          </div>
        </div>
      )}

      {booking && (
        <div>
          <label className={labelCls}>Provider</label>
          <select value={form.provider_id} onChange={e => set('provider_id', e.target.value)} className={inputCls}>
            <option value="">None</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {hasCompliance && (
        isCardType ? (
          <div className="grid grid-cols-2 gap-2">
            <FileTile label="Front of Card" fileUrl={form.front_url} fileName={form.front_name} uploading={uploadingSide === 'front'} onFile={(f) => handleFile(f, 'front')} />
            <FileTile label="Back of Card" fileUrl={form.back_url} fileName={form.back_name} uploading={uploadingSide === 'back'} onFile={(f) => handleFile(f, 'back')} />
          </div>
        ) : (
          <FileTile label="Certificate" fileUrl={form.front_url} fileName={form.front_name} uploading={uploadingSide === 'front'} onFile={(f) => handleFile(f, 'front')} />
        )
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
        {!confirmDelete ? (
          <>
            <button onClick={handleSave} disabled={saving || !!uploadingSide}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Save
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition border border-red-200">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={onDone} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">Cancel</button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-slate-600 flex-1">Delete this training record?</span>
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">No</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FileTile({ label, fileUrl, fileName, uploading, onFile }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</span>
      <label className="flex flex-col items-center gap-1.5 p-2.5 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition h-full min-h-[110px] justify-center">
        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => onFile(e.target.files?.[0])} />
        {uploading ? (
          <Loader2 className="w-5 h-5 text-[#2E5A1A] animate-spin" />
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
        {fileUrl && <span className="text-[9px] text-[#2E5A1A] font-semibold">Replace</span>}
      </label>
    </label>
  );
}