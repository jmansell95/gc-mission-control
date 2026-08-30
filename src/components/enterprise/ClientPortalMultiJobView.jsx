import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, MapPin, Calendar, TrendingUp, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * ClientPortalMultiJobView — consolidated portal view for clients with
 * multiple jobs under one project. Shows aggregated progress, shared
 * milestones, combined billing, and a project-level photo timeline.
 */
export default function ClientPortalMultiJobView({ clientId, client }) {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['portal-multi-jobs', clientId],
    queryFn: () => clientId ? base44.entities.Job.filter({ client_id: clientId }) : [],
    enabled: !!clientId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['portal-multi-invoices', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const allInvoices = await base44.entities.Invoice.list('-created_date', 500);
      return allInvoices.filter(inv => jobs.some(j => j.id === inv.job_id));
    },
    enabled: !!clientId && jobs.length > 0,
  });
  const { data: milestones = [] } = useQuery({
    queryKey: ['portal-multi-milestones', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const all = await base44.entities.JobMilestone.list('-created_date', 500);
      return all.filter(m => jobs.some(j => j.id === m.job_id));
    },
    enabled: !!clientId && jobs.length > 0,
  });
  const { data: photos = [] } = useQuery({
    queryKey: ['portal-multi-photos', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const all = await base44.entities.SitePhoto.list('-created_date', 200);
      return all.filter(p => jobs.some(j => j.id === p.job_id));
    },
    enabled: !!clientId && jobs.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        No jobs found for this client.
      </div>
    );
  }

  // Aggregate stats
  const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
  const totalOutstanding = totalInvoiced - totalPaid;
  const completedMilestones = milestones.filter(m => m.completed).length;
  const totalMilestones = milestones.length;
  const progressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Project header */}
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{client?.name || 'Project'} — Multi-Job Overview</h2>
            <p className="text-sm text-slate-500">{jobs.length} jobs · {activeJobs} active · {completedJobs} completed</p>
          </div>
        </div>

        {/* Aggregated stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-xs text-emerald-600 font-semibold uppercase">Total Invoiced</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">£{totalInvoiced.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs text-blue-600 font-semibold uppercase">Paid</p>
            <p className="text-lg font-bold text-blue-700 tabular-nums">£{totalPaid.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-xs text-amber-600 font-semibold uppercase">Outstanding</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">£{totalOutstanding.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-xs text-slate-500 font-semibold uppercase">Progress</p>
            <p className="text-lg font-bold text-slate-700 tabular-nums">{progressPct}%</p>
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="insight-card rounded-2xl p-4">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Jobs in this project</h3>
        <div className="space-y-2">
          {jobs.map(job => {
            const jobInvoices = invoices.filter(i => i.job_id === job.id);
            const jobMilestones = milestones.filter(m => m.job_id === job.id);
            const jobCompleted = jobMilestones.filter(m => m.completed).length;
            const jobProgress = jobMilestones.length > 0 ? Math.round((jobCompleted / jobMilestones.length) * 100) : 0;
            const statusColor = job.status === 'in_progress' ? 'emerald' : job.status === 'completed' ? 'slate' : 'amber';
            return (
              <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
                <div className={`w-2 h-10 rounded-full bg-${statusColor}-500 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{job.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {job.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {job.location}</span>}
                    {job.start_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {format(new Date(job.start_date), 'dd MMM')}</span>}
                    <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> {jobProgress}%</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-slate-700">
                    £{jobInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">{job.status?.replace('_', ' ')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shared milestones */}
      {milestones.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Shared Milestones</h3>
          <div className="space-y-1.5">
            {milestones.slice(0, 10).map(m => {
              const job = jobs.find(j => j.id === m.job_id);
              return (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${m.completed ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  <span className={m.completed ? 'text-slate-700' : 'text-slate-500'}>{m.title}</span>
                  {job && <span className="text-xs text-slate-400">· {job.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo timeline */}
      {photos.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-400" /> Project Photo Timeline
          </h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {photos.slice(0, 15).map(photo => (
              <div key={photo.id} className="flex-shrink-0">
                <img src={photo.photo_url} alt={photo.caption || ''} className="w-24 h-24 rounded-xl object-cover" />
                  <p className="text-[10px] text-slate-400 mt-1 text-center">
                    {photo.created_date ? format(new Date(photo.created_date), 'dd MMM') : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}