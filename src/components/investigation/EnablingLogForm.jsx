import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Wrench, Undo2, Send, Trash2, Plus, X, Camera, CheckCircle2, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import CompletedBySelector from './CompletedBySelector';
import { useConfigLists } from '@/hooks/useConfigLists';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

const enablingLogTypes = [
  { value: 'site_setup', label: 'Site Setup', icon: Wrench },
  { value: 'reinstatement', label: 'Reinstatement', icon: Undo2 },
];

export default function EnablingLogForm({ staffId, jobId, job, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { getOptions } = useConfigLists();
  const reinstatementOptions = getOptions('reinstatement_types');

  const [form, setForm] = useState({
    log_type: 'reinstatement',
    completed_by_type: 'internal_staff',
    completed_by_name: '',
    borehole_ref: '',
    reinstatement_type: 'none',
    backfill_material: '',
    description: '',
    photo_urls: '',
    verification_photo_urls: '',
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-today', jobId, staffId, todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, date: todayStr }),
  });

  const handlePhotoUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const existing = form[field] ? form[field].split(',').filter(Boolean) : [];
      existing.push(res.file_url);
      setForm({ ...form, [field]: existing.join(',') });
      toast({ title: 'Photo attached' });
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
    setUploadingPhoto(false);
  };

  const handleAdd = async () => {
    if (form.completed_by_type !== 'internal_staff' && !form.completed_by_name.trim()) {
      toast({ title: 'Name required', description: 'Enter the client/contractor representative name.', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'reinstatement') {
      if (!form.verification_photo_urls) {
        toast({ title: 'Photos required', description: 'Pre/Post-dig verification photos are mandatory.', variant: 'destructive' });
        return;
      }
      if (!form.reinstatement_type || form.reinstatement_type === 'none') {
        toast({ title: 'Reinstatement type required', variant: 'destructive' });
        return;
      }
    }
    setAdding(true);
    try {
      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        source: 'staff',
        logged_by_role: 'enabling_crew',
        crew_type: 'enabling',
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        reinstatement_type: form.reinstatement_type || 'none',
        backfill_material: form.backfill_material || '',
        description: form.description || '',
        photo_urls: form.photo_urls || '',
        verification_photo_urls: form.verification_photo_urls || '',
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
        completed_by_type: form.completed_by_type || 'internal_staff',
        completed_by_name: form.completed_by_type === 'internal_staff'
          ? (staffName || '')
          : (form.completed_by_name || ''),
        chargeable: form.completed_by_type !== 'client',
        billing_status: form.completed_by_type === 'client' ? 'no_charge' : 'auto',
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      toast({ title: 'Log entry added' });
      setForm({
        ...form,
        borehole_ref: '', reinstatement_type: 'none', backfill_material: '',
        description: '', photo_urls: '', verification_photo_urls: '',
        completed_by_name: '',
      });
      setShowForm(false);
    } catch (e) {
      toast({ title: 'Error adding log', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this log entry?')) return;
    try {
      await base44.entities.InvestigationLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
    } catch (e) { console.error(e); }
  };

  const isReinstatement = form.log_type === 'reinstatement';
  const isExternalParty = form.completed_by_type !== 'internal_staff';
  const verificationPhotos = form.verification_photo_urls ? form.verification_photo_urls.split(',').filter(Boolean) : [];
  const evidencePhotos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
          <Undo2 className="w-4 h-4 text-teal-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Site Reinstatement</h3>
          <p className="text-xs text-slate-400">Pre/Post-dig photos · Backfill · Safety closeout</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {todayLogs.map(log => (
            <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-teal-700 capitalize">{log.log_type.replace(/_/g, ' ')}</span>
                  {log.borehole_ref && <span className="text-xs font-mono font-bold text-slate-700">{log.borehole_ref}</span>}
                  {log.reinstatement_type && log.reinstatement_type !== 'none' && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{log.reinstatement_type.replace(/_/g, ' ')}</span>
                  )}
                  {log.verification_photo_urls && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                    </span>
                  )}
                  {log.completed_by_type && log.completed_by_type !== 'internal_staff' && (
                    <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">
                      {log.completed_by_type === 'client' ? 'Client' : 'Contractor'}{log.completed_by_name ? ` · ${log.completed_by_name}` : ''}{log.created_at ? ` @ ${format(new Date(log.created_at), 'HH:mm')}` : ''}
                    </span>
                  )}
                </div>
                {log.backfill_material && <p className="text-xs text-slate-600 mt-0.5">Backfill: {log.backfill_material}</p>}
                {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
              </div>
              <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">New Reinstatement / Setup Entry</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-1.5">
            {enablingLogTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition ${form.log_type === t.value ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <CompletedBySelector
            value={form.completed_by_type}
            onChange={(v) => setForm({ ...form, completed_by_type: v })}
            nameValue={form.completed_by_name}
            onNameChange={(v) => setForm({ ...form, completed_by_name: v })}
            accent="teal"
          />

          {isReinstatement && !isExternalParty && (
            <>
              <div>
                <label className={labelCls}>Location Ref (optional)</label>
                <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                  placeholder="e.g. TP-01, BH-03, Area B" className={inputCls} />
              </div>

              <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Undo2 className="w-3.5 h-3.5 text-teal-600" />
                  <p className="text-xs font-semibold text-teal-700">Reinstatement Type (Required)</p>
                </div>
                <select value={form.reinstatement_type} onChange={e => setForm({ ...form, reinstatement_type: e.target.value })} className={inputCls}>
                  {reinstatementOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Backfill Material</label>
                <input type="text" value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })}
                  placeholder="e.g. Type 1 granular, site-won clay" className={inputCls} />
              </div>

              {/* Verification photos — MANDATORY for reinstatement */}
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">Pre/Post-Dig Verification Photos (Required)</p>
                </div>
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-emerald-300 rounded-xl text-xs text-emerald-600 hover:border-emerald-500 hover:bg-emerald-100 cursor-pointer transition">
                  {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Add Verification Photo</>}
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'verification_photo_urls')} className="hidden" disabled={uploadingPhoto} />
                </label>
                {verificationPhotos.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {verificationPhotos.length} verification photo(s) attached
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Notes on backfill, compaction, site safety..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Additional evidence photos */}
          <div>
            <label className={labelCls}>Additional Photos</label>
            <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition">
              {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Photo</>}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, 'photo_urls')} className="hidden" disabled={uploadingPhoto} />
            </label>
            {evidencePhotos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{evidencePhotos.length} photo(s) attached</p>}
          </div>

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 text-white rounded-xl hover:bg-teal-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 rounded-xl hover:bg-teal-100 active:scale-95 transition text-sm font-semibold border border-teal-200 touch-manipulation">
          <Plus className="w-4 h-4" /> Log Setup / Reinstatement
        </button>
      )}
    </div>
  );
}