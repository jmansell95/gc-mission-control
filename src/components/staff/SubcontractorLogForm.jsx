import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, Camera, Plus, Trash2, Ruler, CheckCircle2, Loader2, Wrench, HardHat, Undo2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-4 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 bg-white";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

const activityTypes = [
  { value: 'site_setup', label: 'Site Setup', icon: Wrench, color: 'teal' },
  { value: 'borehole_progress', label: 'Drilling', icon: Ruler, color: 'blue', showMeters: true },
  { value: 'pit_excavation', label: 'Groundworks', icon: HardHat, color: 'amber', showUnits: true },
  { value: 'reinstatement', label: 'Reinstatement', icon: Undo2, color: 'emerald' },
];

export default function SubcontractorLogForm({ staffId, staffName, jobs }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    job_id: '',
    log_type: 'borehole_progress',
    borehole_ref: '',
    meters_drilled: '',
    units_completed: '',
    units_label: 'metres',
    description: '',
    duration_minutes: '',
    photo_urls: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const existing = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];
      existing.push(res.file_url);
      setForm(prev => ({ ...prev, photo_urls: existing.join(',') }));
      toast({ title: 'Photo attached' });
    } catch (err) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.job_id) {
      toast({ title: 'Select a job', description: 'Choose the job you worked on today.', variant: 'destructive' });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: 'Add remarks', description: 'Tell us what you did today.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        job_id: form.job_id,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        source: 'staff',
        logged_by_role: 'subcontractor',
        crew_type: 'subcontractor',
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        description: form.description,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        photo_urls: form.photo_urls || '',
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
        completed_by_type: 'contractor',
        completed_by_name: staffName || '',
        chargeable: true,
        billing_status: 'auto',
      };
      if (form.log_type === 'borehole_progress' && form.meters_drilled) {
        payload.units_completed = Number(form.meters_drilled);
        payload.units_label = 'metres';
      }
      if (form.units_completed && form.units_label) {
        payload.units_completed = Number(form.units_completed);
        payload.units_label = form.units_label;
      }
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', staffId] });
      queryClient.invalidateQueries({ queryKey: ['subcon-weekly-progress', staffId] });
      toast({ title: 'Sent to office', description: 'Your daily log has been submitted.' });
      setForm(prev => ({
        ...prev,
        borehole_ref: '', meters_drilled: '', units_completed: '', units_label: 'metres',
        description: '', duration_minutes: '', photo_urls: '',
      }));
    } catch (e) {
      toast({ title: 'Error sending log', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const photos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];
  const selectedActivity = activityTypes.find(a => a.value === form.log_type);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="w-5 h-5" /> Log My Day
        </h3>
        <p className="text-teal-50 text-sm mt-0.5">Record your work and send it to the office.</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Job selector */}
        <div>
          <label className={labelCls}>Which job did you work on?</label>
          <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })}
            className={inputCls}>
            <option value="">Select a job…</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.name}{j.location ? ` — ${j.location}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Activity type */}
        <div>
          <label className={labelCls}>What did you do?</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activityTypes.map(a => {
              const Icon = a.icon;
              const active = form.log_type === a.value;
              return (
                <button key={a.value} type="button" onClick={() => setForm({ ...form, log_type: a.value })}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition touch-manipulation ${active ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <Icon className={`w-6 h-6 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span className={`text-xs font-semibold ${active ? 'text-teal-700' : 'text-slate-500'}`}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Borehole ref */}
        <div>
          <label className={labelCls}>Location / Borehole Ref (optional)</label>
          <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
            placeholder="e.g. BH-01, TP-03, Area B" className={inputCls} />
        </div>

        {/* Meters drilled (only for drilling) */}
        {selectedActivity?.showMeters && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <label className={labelCls + " flex items-center gap-1.5"}>
              <Ruler className="w-4 h-4 text-blue-600" /> Metres Drilled Today
            </label>
            <input type="number" inputMode="decimal" step="0.1" value={form.meters_drilled}
              onChange={e => setForm({ ...form, meters_drilled: e.target.value })}
              placeholder="0" className={inputCls} />
          </div>
        )}

        {/* Units completed (for groundworks) */}
        {selectedActivity?.showUnits && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <label className={labelCls}>Units Completed</label>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={form.units_completed}
                onChange={e => setForm({ ...form, units_completed: e.target.value })}
                placeholder="0" className={inputCls + " flex-1"} />
              <input type="text" value={form.units_label}
                onChange={e => setForm({ ...form, units_label: e.target.value })}
                placeholder="pits" className={inputCls + " w-28"} />
            </div>
          </div>
        )}

        {/* Duration */}
        <div>
          <label className={labelCls}>Hours on site (optional)</label>
          <input type="number" inputMode="numeric" value={form.duration_minutes}
            onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
            placeholder="e.g. 480 (minutes)" className={inputCls} />
        </div>

        {/* Remarks */}
        <div>
          <label className={labelCls}>Daily Remarks</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
            placeholder="Describe what you did today, ground conditions, any issues…"
            className={inputCls + " resize-none"} />
        </div>

        {/* Photos */}
        <div>
          <label className={labelCls}>Evidence Photos</label>
          <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition touch-manipulation">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5" /> Add Photo</>}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
          </label>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {photos.map((url, i) => (
                <img key={i} src={url} alt="Evidence" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation safe-area-bottom">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {submitting ? 'Sending…' : 'Send to Office'}
        </button>
      </div>
    </div>
  );
}