import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Drill, ArrowRight, MapPin, Loader2, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * RigRedirectModal — staff self-redirect a rig from its current site to
 * another job by scanning its QR. Shows the rig name, its current job, a
 * searchable destination-job picker, and a confirm button that calls the
 * redirectRigToJob backend function.
 *
 * Props: { rig, currentJobId, currentJobName, staffProfile, onClose, onDone }
 */
export default function RigRedirectModal({ rig, currentJobId, currentJobName, staffProfile, onClose, onDone }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-redirect'],
    queryFn: () => base44.entities.Job.list(),
  });

  // Active jobs the rig can be redirected to (exclude completed/cancelled and the current job)
  const availableJobs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return jobs
      .filter(j => j.id !== currentJobId && j.status !== 'completed' && j.status !== 'cancelled')
      .filter(j => !q || (j.name || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q) || (j.job_reference || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [jobs, search, currentJobId]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const handleConfirm = async () => {
    if (!selectedJobId) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('redirectRigToJob', {
        rig_id: rig.id,
        from_job_id: currentJobId,
        to_job_id: selectedJobId,
        staff_id: staffProfile?.id || '',
        staff_name: staffProfile?.name || '',
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setDone(true);
      toast({
        title: 'Rig redirected',
        description: `${rig.name} moved to ${data.to_job || selectedJob?.name}. Management notified.`,
      });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      setTimeout(() => { onDone?.(); onClose?.(); }, 1400);
    } catch (e) {
      toast({ title: 'Redirect failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white px-5 py-4 rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Drill className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white truncate">Redirect Rig to Another Site</h3>
                <p className="text-xs text-white/70 truncate">Staff self-redirect · management will be notified</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition flex-shrink-0">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {done ? (
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">Rig redirected</p>
            <p className="text-sm text-slate-500 mt-1">Management has been notified.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Rig + current job summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Drill className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-bold text-slate-900 truncate">{rig.name}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Currently on site at <span className="font-semibold text-slate-700">{currentJobName || 'unknown job'}</span></span>
              </div>
            </div>

            {/* Destination job picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Send rig to</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search jobs by name or location…"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : availableJobs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No active jobs found{search ? ` for "${search}"` : ''}.</div>
                ) : (
                  availableJobs.slice(0, 60).map(j => {
                    const isSel = selectedJobId === j.id;
                    return (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setSelectedJobId(j.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition ${isSel ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                          {isSel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{j.name || 'Unnamed job'}</p>
                          <p className="text-[11px] text-slate-400 truncate">{j.location || 'No location'}{j.job_reference ? ` · ${j.job_reference}` : ''}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                This releases the rig from <strong>{currentJobName || 'its current job'}</strong> and stamps it on-site at the destination. Management will be emailed automatically.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedJobId || submitting}
                className="flex-1 py-3 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-bold text-sm hover:brightness-110 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {submitting ? 'Redirecting…' : 'Confirm Redirect'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}