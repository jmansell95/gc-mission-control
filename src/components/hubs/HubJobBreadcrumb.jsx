import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, FolderOpen } from 'lucide-react';

/**
 * HubJobBreadcrumb — when a hub is opened with ?jobId=X&from=job, this
 * renders a sticky breadcrumb bar at the top showing "← Back to [Job Name]".
 *
 * Clicking it returns to the admin dashboard with the job drawer open (the
 * standard job-detail entry point). This is the "bidirectional" half of the
 * cross-hub linking: Job Detail → Hub (deep-link button) → Hub → Job Detail
 * (this breadcrumb).
 *
 * Render it at the top of any hub page that supports job-scoped deep links.
 * It returns null when there's no jobId in the URL, so it's safe to always
 * include.
 */
export default function HubJobBreadcrumb() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jobId = params.get('jobId');
  const from = params.get('from');

  const { data: job } = useQuery({
    queryKey: ['job-for-breadcrumb', jobId],
    queryFn: () => base44.entities.Job.get(jobId),
    enabled: !!jobId,
  });

  if (!jobId || from !== 'job') return null;

  const jobName = job?.name || 'Job';

  return (
    <div className="animate-slide-up">
      <Link
        to={`/admin?job=${jobId}`}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#2E5A1A]/20 transition-all shadow-sm group"
      >
        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-[#2E5A1A] transition-colors" />
        <FolderOpen className="w-4 h-4 text-[#2E5A1A]" />
        <span className="text-slate-500">Back to</span>
        <span className="text-slate-900 truncate max-w-[240px]">{jobName}</span>
      </Link>
    </div>
  );
}