import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users, Wrench, MapPin, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import { format, addDays, isAfter, isBefore } from 'date-fns';

export default function SiteReadinessGateWidget({ onNavigate }) {
  const today = new Date();
  const weekEnd = addDays(today, 7);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-readiness'],
    queryFn: () => base44.entities.Job.list('-start_date', 50),
  });

  const weekStartStr = format(today, 'yyyy-MM-dd');
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-readiness', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr }),
  });

  const { data: assetAssignments = [] } = useQuery({
    queryKey: ['asset-assignments-readiness'],
    queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 100),
  });

  const upcomingJobs = jobs.filter(j => {
    if (j.status === 'in_progress') return true;
    if (j.start_date) {
      const start = new Date(j.start_date);
      return isAfter(start, addDays(today, -1)) && isBefore(start, weekEnd);
    }
    return false;
  }).slice(0, 6);

  const checkJobReadiness = (job) => {
    const crewAssigned = rotas.some(r => r.job_id === job.id);
    const assetsAssigned = assetAssignments.some(a => a.job_id === job.id);
    const siteSet = !!(job.location && (job.site_lat != null || job.site_lng != null));
    const checks = [
      { label: 'Crew', passed: crewAssigned, icon: Users },
      { label: 'Assets', passed: assetsAssigned, icon: Wrench },
      { label: 'Site', passed: siteSet, icon: MapPin },
    ];
    const passedCount = checks.filter(c => c.passed).length;
    const status = passedCount === 3 ? 'ready' : passedCount === 0 ? 'blocked' : 'partial';
    return { checks, status };
  };

  const statusConfig = {
    ready: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2, label: 'Ready' },
    partial: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertCircle, label: 'Partial' },
    blocked: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: XCircle, label: 'Blocked' },
  };

  if (isLoading) return <HubLoadingState variant="list" count={3} />;

  if (upcomingJobs.length === 0) {
    return (
      <HubEmptyState
        icon={ShieldCheck}
        title="No jobs scheduled in the next 7 days"
        description="Jobs starting soon will appear here with pre-deployment readiness checks."
        compact
      />
    );
  }

  return (
    <HubCard icon={ShieldCheck} title="Site Readiness Gate" subtitle={`${upcomingJobs.length} job${upcomingJobs.length === 1 ? '' : 's'} to verify before deployment`} tone="brand">
      <div className="space-y-2.5">
        {upcomingJobs.map(job => {
          const { checks, status } = checkJobReadiness(job);
          const cfg = statusConfig[status];
          const StatusIcon = cfg.icon;
          return (
            <div key={job.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{job.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {job.start_date ? format(new Date(job.start_date), 'dd MMM') : 'TBD'}
                    {job.location ? ` · ${job.location}` : ''}
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-bold ${cfg.color} flex-shrink-0`}>
                  <StatusIcon className="w-4 h-4" />
                  {cfg.label}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {checks.map((check, i) => {
                  const CheckIcon = check.icon;
                  return (
                    <div key={i} className="flex items-center gap-1 text-[11px]">
                      <CheckIcon className={`w-3.5 h-3.5 ${check.passed ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <span className={check.passed ? 'text-slate-600 font-medium' : 'text-slate-400'}>{check.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </HubCard>
  );
}