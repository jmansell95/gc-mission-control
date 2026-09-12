import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  X, Upload, Loader2, Sparkles, CheckCircle2, Users, FileText, Image, AlertCircle,
  ChevronRight, Calendar, Building2,
} from 'lucide-react';

const TYPE_COLORS = {
  driver_license_front: 'bg-blue-100 text-blue-700',
  driver_license_back: 'bg-indigo-100 text-indigo-700',
  cscs_card: 'bg-violet-100 text-violet-700',
  cpcs_card: 'bg-violet-100 text-violet-700',
  npors_card: 'bg-violet-100 text-violet-700',
  first_aid_cert: 'bg-emerald-100 text-emerald-700',
  dbs_certificate: 'bg-amber-100 text-amber-700',
  forklift_cert: 'bg-orange-100 text-orange-700',
  nvq: 'bg-cyan-100 text-cyan-700',
  ipaf: 'bg-teal-100 text-teal-700',
  pasma: 'bg-teal-100 text-teal-700',
  confined_space: 'bg-rose-100 text-rose-700',
  asbestos_awareness: 'bg-rose-100 text-rose-700',
  manual_handling: 'bg-slate-100 text-slate-700',
  working_at_height: 'bg-slate-100 text-slate-700',
  other_training_cert: 'bg-slate-100 text-slate-500',
};

const typePill = (t) => TYPE_COLORS[t] || TYPE_COLORS.other_training_cert;
const typeLabel = (t) => (t || 'other_training_cert').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * BulkTrainingImportModal — AI-powered bulk certificate import.
 * Manager selects crew (or all), uploads multiple certificate files, the
 * backend classifies each via vision LLM, then a preview grid lets the
 * manager review/edit before committing all records (TrainingBooking +
 * ComplianceItem) in one go.
 */
export default function BulkTrainingImportModal({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [files, setFiles] = useState([]); // { file_url, file_name }[]
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [results, setResults] = useState(null); // { results: [...] }
  const [committing, setCommitting] = useState(false);

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: providers = [] } = useQuery({
    queryKey: ['training-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }),
  });

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    const list = q ? staff.filter(s => (s.name || '').toLowerCase().includes(q)) : staff;
    return list.filter(s => s.is_active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [staff, staffSearch]);

  const allSelected = selectedStaffIds.length === filteredStaff.length && filteredStaff.length > 0;
  const toggleStaff = (id) => setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedStaffIds(allSelected ? [] : filteredStaff.map(s => s.id));

  const handleFileSelect = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(fileList)) {
        try {
          const res = await base44.integrations.Core.UploadFile({ file });
          uploaded.push({ file_url: res.file_url, file_name: file.name });
        } catch (e) { /* skip failed */ }
      }
      setFiles(prev => [...prev, ...uploaded]);
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleClassify = async () => {
    if (files.length === 0) { toast({ title: 'Upload at least one file first', variant: 'destructive' }); return; }
    if (selectedStaffIds.length === 0) { toast({ title: 'Select at least one crew member', variant: 'destructive' }); return; }
    setClassifying(true);
    try {
      const roster = selectedStaffIds.map(id => {
        const s = staff.find(x => x.id === id);
        return { id, name: s?.name || '' };
      });
      const res = await base44.functions.invoke('classifyTrainingCertificates', { files, staff: roster });
      if (res.data?.error) throw new Error(res.data.error);
      // Default each result to the first selected staff if no match
      const defaultStaffId = selectedStaffIds[0];
      const defaultStaffName = staff.find(s => s.id === defaultStaffId)?.name || '';
      const enriched = (res.data?.results || []).map(r => ({
        ...r,
        staff_id: r.matched_staff_id || defaultStaffId,
        staff_name: staff.find(s => s.id === (r.matched_staff_id || defaultStaffId))?.name || defaultStaffName,
      }));
      setResults({ results: enriched });
    } catch (e) {
      toast({ title: 'Classification failed', description: e.message, variant: 'destructive' });
    }
    setClassifying(false);
  };

  const updateResult = (idx, patch) => {
    setResults(prev => {
      const results = [...prev.results];
      results[idx] = { ...results[idx], ...patch };
      if (patch.staff_id) {
        results[idx].staff_name = staff.find(s => s.id === patch.staff_id)?.name || results[idx].staff_name;
      }
      return { results };
    });
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const records = results.results.map(r => ({
        staff_id: r.staff_id,
        staff_name: r.staff_name,
        qualification_type: r.qualification_type,
        document_type: r.document_type,
        holder_name: r.holder_name,
        issue_date: r.issue_date,
        expiry_date: r.expiry_date,
        provider_name: r.provider_name,
        file_url: r.file_url,
        file_name: r.file_name,
        is_front: r.is_front,
        is_back: r.is_back,
      }));
      const res = await base44.functions.invoke('commitTrainingImport', { records });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['compliance-items-staff'] });
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-training-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-compliance'] });
      toast({ title: 'Import complete', description: `${res.data?.created?.bookings || 0} training records + ${res.data?.created?.compliance || 0} certificates created.` });
      onClose();
    } catch (e) {
      toast({ title: 'Commit failed', description: e.message, variant: 'destructive' });
    }
    setCommitting(false);
  };

  const inputCls = 'w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base">Bulk Import Training</h3>
              <p className="text-xs text-white/70">AI classifies each certificate — review then commit</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Select crew */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Select Crew ({selectedStaffIds.length})</p>
              <button onClick={toggleAll} className="text-[11px] font-semibold text-primary hover:underline">
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Search crew…"
              className="w-full px-3 py-2 mb-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
            <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {filteredStaff.slice(0, 50).map(s => {
                const checked = selectedStaffIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleStaff(s.id)}
                    className={'w-full flex items-center gap-2.5 p-2 text-left transition ' + (checked ? 'bg-primary/5' : 'hover:bg-slate-50')}>
                    <div className={'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ' + (checked ? 'bg-primary border-primary' : 'border-slate-300')}>
                      {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload files */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">2. Upload Certificates</p>
            <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition">
              <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={e => handleFileSelect(e.target.files)} />
              {uploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-slate-400" />}
              <p className="text-sm font-medium text-slate-600">{uploading ? 'Uploading…' : 'Drop certificate files here or click to browse'}</p>
              <p className="text-[10px] text-slate-400">Images or PDFs · AI will detect type, name, dates, provider</p>
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    {f.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <Image className="w-3.5 h-3.5 text-slate-400" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-xs text-slate-600 truncate flex-1">{f.file_name}</span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Classify */}
          {files.length > 0 && selectedStaffIds.length > 0 && !results && (
            <button onClick={handleClassify} disabled={classifying}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-50 transition shadow-sm">
              {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {classifying ? 'AI classifying…' : `Classify ${files.length} file${files.length !== 1 ? 's' : ''} with AI`}
            </button>
          )}

          {/* Step 4: Preview + edit */}
          {results && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">3. Review & Edit ({results.results.length})</p>
                <button onClick={() => setResults(null)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700">← Back to upload</button>
              </div>
              {results.results.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-1.5 text-amber-400" />
                  <p className="text-sm">No certificates detected. Try clearer scans.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.results.map((r, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3 bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + typePill(r.document_type)}>{typeLabel(r.document_type)}</span>
                        {r.confidence < 0.7 && <span className="text-[10px] text-amber-600 font-semibold">Low confidence</span>}
                        <span className="ml-auto text-[10px] text-slate-400 truncate max-w-[120px]">{r.file_name}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Crew</label>
                          <select value={r.staff_id} onChange={e => updateResult(i, { staff_id: e.target.value })} className={inputCls}>
                            {selectedStaffIds.map(id => {
                              const s = staff.find(x => x.id === id);
                              return <option key={id} value={id}>{s?.name || id}</option>;
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Qual Type</label>
                          <select value={r.qualification_type} onChange={e => updateResult(i, { qualification_type: e.target.value })} className={inputCls}>
                            {['cscs_card','cpcs_card','npors_card','first_aid_cert','driver_license','dbs_certificate','forklift','other'].map(q => <option key={q} value={q}>{q.replace(/_/g,' ')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Issue Date</label>
                          <input type="text" value={r.issue_date || ''} onChange={e => updateResult(i, { issue_date: e.target.value })} placeholder="YYYY-MM-DD" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Expiry</label>
                          <input type="text" value={r.expiry_date || ''} onChange={e => updateResult(i, { expiry_date: e.target.value })} placeholder="YYYY-MM-DD" className={inputCls} />
                        </div>
                      </div>
                      {r.holder_name && <p className="text-[10px] text-slate-400 mt-1.5">Detected name: {r.holder_name}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            {results && (
              <button onClick={handleCommit} disabled={committing || results.results.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
                {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {committing ? 'Committing…' : `Commit ${results.results.length} Record${results.results.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}