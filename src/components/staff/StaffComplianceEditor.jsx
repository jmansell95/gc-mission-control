import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, ShieldCheck, X, Upload, FileText, Loader2, CreditCard, Calendar, AlertTriangle, CheckCircle2, XCircle, Crop } from 'lucide-react';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import ImageCropper from '@/components/ImageCropper';

const FALLBACK_QUALIFICATION_TYPES = [
  { value: 'cscs_card', label: 'CSCS Card', requiresFrontBack: true },
  { value: 'cpcs_card', label: 'CPCS Card', requiresFrontBack: true },
  { value: 'npors_card', label: 'NPORS Card', requiresFrontBack: true },
  { value: 'first_aid_cert', label: 'First Aid Certificate', requiresFrontBack: false },
  { value: 'driver_license', label: 'Driver Licence', requiresFrontBack: true },
  { value: 'dbs_certificate', label: 'DBS Certificate', requiresFrontBack: false },
  { value: 'other', label: 'Other', requiresFrontBack: false },
];

function getStatus(item) {
  if (item.status_override === 'missing') return { label: 'Missing', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100', dot: 'bg-red-500' };
  if (item.status_override === 'not_required') return { label: 'N/A', Icon: CheckCircle2, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', dot: 'bg-slate-300' };
  if (!item.expiry_date) return { label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', dot: 'bg-slate-300' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', dot: 'bg-slate-300' };
  if (days < 0) return { label: 'Expired', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100', dot: 'bg-red-500' };
  if (days <= 30) return { label: `${days}d left`, Icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100', dot: 'bg-amber-500' };
  return { label: 'Valid', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100', dot: 'bg-emerald-500' };
}

const emptyForm = {
  title: '',
  qualification_type: 'other',
  card_number: '',
  issue_date: '',
  expiry_date: '',
  notes: '',
  document_url: '',
  document_name: '',
  back_document_url: '',
  back_document_name: '',
  status_override: 'auto',
};

const inputClass = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50 transition';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5';

export default function StaffComplianceEditor({ staffId, staffName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [cropState, setCropState] = useState(null);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-compliance-edit', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });
  const { data: requirements = [] } = useQuery({
    queryKey: ['training-requirements'],
    queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100),
  });

  const QUALIFICATION_TYPES = useMemo(() => {
    if (requirements.length === 0) return FALLBACK_QUALIFICATION_TYPES;
    const types = requirements.map(r => ({
      value: r.qualification_type,
      label: r.label,
      requiresFrontBack: !!r.requires_front_back,
    }));
    types.push({ value: 'other', label: 'Other', requiresFrontBack: false });
    return types;
  }, [requirements]);

  const items = allItems.filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName));

  const handleFileSelected = (file, side) => {
    if (!file) return;
    // PDFs and non-images skip cropping
    if (!file.type.startsWith('image/')) {
      handleUpload(file, side);
      return;
    }
    const url = URL.createObjectURL(file);
    setCropState({ url, side, fileName: file.name });
  };

  const handleCropConfirm = async (croppedFile) => {
    const side = cropState.side;
    setCropState(null);
    await handleUpload(croppedFile, side);
  };

  const handleUpload = async (file, side) => {
    if (!file) return;
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      if (side === 'front') {
        setForm(prev => ({ ...prev, document_url: res.file_url, document_name: file.name }));
      } else {
        setForm(prev => ({ ...prev, back_document_url: res.file_url, back_document_name: file.name }));
      }
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    }
    if (side === 'front') setUploadingFront(false);
    else setUploadingBack(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const qualType = QUALIFICATION_TYPES.find(q => q.value === form.qualification_type);
    if (qualType?.requiresFrontBack && !form.document_url) {
      toast({ title: 'Front of card required', description: `${qualType.label} requires a front image upload.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        category: 'staff',
        reference_id: staffId,
        reference_name: staffName,
      };
      if (editingId) {
        await base44.entities.ComplianceItem.update(editingId, payload);
        toast({ title: 'Compliance item updated' });
      } else {
        await base44.entities.ComplianceItem.create(payload);
        toast({ title: 'Compliance item added' });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (item) => {
    setForm({ ...emptyForm, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete ${item.title}?`)) return;
    try {
      await base44.entities.ComplianceItem.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-edit', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staff-compliance', staffId] });
      toast({ title: 'Item deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
  };

  const requiresFrontBack = QUALIFICATION_TYPES.find(q => q.value === form.qualification_type)?.requiresFrontBack;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Compliance & Qualifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">{staffName}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-xs font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">{editingId ? 'Edit Item' : 'New Compliance Item'}</p>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Qualification Type</label>
              <select value={form.qualification_type} onChange={e => setForm({ ...form, qualification_type: e.target.value, title: QUALIFICATION_TYPES.find(q => q.value === e.target.value)?.label || form.title })}
                className={inputClass}>
                {QUALIFICATION_TYPES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
                className={inputClass} placeholder="e.g. CSCS Card, First Aid Certificate" />
            </div>
            <div>
              <label className={labelClass}>Card / Reg Number</label>
              <input type="text" value={form.card_number || ''} onChange={e => setForm({ ...form, card_number: e.target.value })}
                className={inputClass} placeholder="Optional" />
            </div>
            <div>
              <label className={labelClass}>Status Override</label>
              <select value={form.status_override} onChange={e => setForm({ ...form, status_override: e.target.value })}
                className={inputClass}>
                <option value="auto">Auto (from expiry)</option>
                <option value="missing">Missing</option>
                <option value="not_required">Not Required</option>
              </select>
            </div>
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

          {/* Document uploads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{requiresFrontBack ? 'Front of Card *' : 'Document'}</label>
              {form.document_url ? (
                <UploadedFileChip name={form.document_name} side="front" onClear={() => setForm({ ...form, document_url: '', document_name: '' })} isImage={form.document_url?.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i)} url={form.document_url} />
              ) : (
                <UploadZone uploading={uploadingFront} onFile={f => handleFileSelected(f, 'front')} />
              )}
            </div>
            {requiresFrontBack && (
              <div>
                <label className={labelClass}>Back of Card</label>
                {form.back_document_url ? (
                  <UploadedFileChip name={form.back_document_name} side="back" onClear={() => setForm({ ...form, back_document_url: '', back_document_name: '' })} isImage={form.back_document_url?.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i)} url={form.back_document_url} />
                ) : (
                  <UploadZone uploading={uploadingBack} onFile={f => handleFileSelected(f, 'back')} />
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className={`${inputClass} resize-none`} placeholder="Optional notes" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 shadow-sm">
              {saving ? 'Saving…' : editingId ? 'Update Item' : 'Add Item'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No compliance items yet</p>
          <p className="text-xs text-slate-400 mt-1">Add CSCS cards, certificates and qualifications above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const st = getStatus(item);
            const isCard = item.qualification_type === 'cscs_card' || item.qualification_type === 'cpcs_card' || item.qualification_type === 'npors_card' || item.qualification_type === 'driver_license';
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                    {isCard ? <CreditCard className={`w-5 h-5 ${st.text}`} /> : <st.Icon className={`w-5 h-5 ${st.text}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                      </span>
                    </div>
                    {item.card_number && <p className="text-xs text-slate-500 mt-1">Card #: {item.card_number}</p>}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                      {item.issue_date && <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Issued {formatComplianceDate(item.issue_date)}</span>}
                      {item.expiry_date && <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Expires {formatComplianceDate(item.expiry_date)}</span>}
                    </div>
                    {(item.document_url || item.back_document_url) && (
                      <div className="flex items-center gap-3 mt-2">
                        {item.document_url && (
                          <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> Front
                          </a>
                        )}
                        {item.back_document_url && (
                          <a href={item.back_document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> Back
                          </a>
                        )}
                      </div>
                    )}
                    {item.notes && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cropState && (
        <ImageCropper
          imageSrc={cropState.url}
          aspect={1.586}
          title={`Crop ${cropState.side === 'front' ? 'Front' : 'Back'} of Card`}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropState(null)}
        />
      )}
    </div>
  );
}

function UploadZone({ uploading, onFile }) {
  return (
    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-xl py-5 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition">
      {uploading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Upload className="w-5 h-5 text-slate-400" />}
      <span className="text-xs font-medium text-slate-500">{uploading ? 'Uploading…' : 'Choose file'}</span>
      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Crop className="w-2.5 h-2.5" /> Images auto-crop</span>
      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => onFile(e.target.files[0])} />
    </label>
  );
}

function UploadedFileChip({ name, url, isImage, onClear }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
      {isImage ? (
        <img src={url} alt="Preview" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      )}
      <span className="text-xs text-emerald-700 truncate flex-1">{name || 'Uploaded'}</span>
      <button type="button" onClick={onClear}
        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}