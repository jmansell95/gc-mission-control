import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Briefcase, Loader2, Check, MapPin, Search, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Assign to Job modal — lets the user pick an active job and creates a
 * JobAssetAssignment linking this asset to it.
 */
export default function AssignToJobModal({ asset, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['active-jobs-for-assign'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress'] } }, '-updated_date', 200),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(j =>
      (j.name || '').toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q) ||
      (j.job_reference || '').toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const handleSubmit = async () => {
    if (!selectedJob) return;
    setSaving(true);
    try {
      await base44.entities.JobAssetAssignment.create({
        asset_id: asset.id,
        job_id: selectedJob.id,
        job_name: selectedJob.name,
        asset_name: asset.name,
        status: 'assigned',
        assigned_date: format(new Date(), 'yyyy-MM-dd'),
      });
      queryClient.invalidateQueries({ queryKey: ['asset-deployments', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['asset-deployments'] });
      toast({ title: 'Assigned', description: `${asset.name} assigned to ${selectedJob.name}.` });
      onClose();
    } catch (err) {
      console.error('Assign error:', err);
      toast({ title: 'Error', description: 'Could not assign asset. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-pop-in">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> Assign to Job
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Assign <strong className="text-slate-700">{asset?.name}</strong> to an active job.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Job list */}
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No active jobs found.</p>
            ) : (
              filtered.map(job => {
                const active = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      active ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {active ? <Check className="w-4 h-4 text-emerald-600" /> : <Briefcase className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{job.name}</p>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {job.location || 'No location'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedJob || saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-[#244715] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}