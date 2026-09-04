import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useHubJobFilter — reads ?jobId=X from the URL (set by HubDeepLink) and
 * fetches the job so the hub can pre-filter its data to that job.
 *
 * Returns:
 *   jobId    — the raw job ID from the URL (or null)
 *   job      — the Job entity (or null while loading)
 *   isJobScoped — boolean, true when a jobId is present in the URL
 *   clearJobFilter — function to remove the jobId param (clears the filter)
 */
export function useHubJobFilter() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId');

  const { data: job } = useQuery({
    queryKey: ['job-for-hub-filter', jobId],
    queryFn: () => base44.entities.Job.get(jobId),
    enabled: !!jobId,
  });

  const clearJobFilter = () => {
    const next = new URLSearchParams(params);
    next.delete('jobId');
    next.delete('from');
    setParams(next, { replace: true });
  };

  return {
    jobId,
    job,
    isJobScoped: !!jobId,
    clearJobFilter,
  };
}