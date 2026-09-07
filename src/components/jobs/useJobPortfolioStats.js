import { useMemo } from 'react';
import { Briefcase, BarChart3, Users, Truck, PoundSterling, Calendar } from 'lucide-react';
import { parseISO, addDays } from 'date-fns';

/** Builds the Projects Hub StatPill tiles from the job portfolio. */
export default function useJobPortfolioStats(jobs, crewCountByJob, rigCountByJob) {
  return useMemo(() => {
    if (!jobs.length) return [];
    const active = jobs.filter(j => ['planning', 'in_progress', 'decommissioning'].includes(j.status || 'planning')).length;
    const inProgress = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
    const totalCrew = Object.values(crewCountByJob).reduce((s, n) => s + n, 0);
    const totalRigs = Object.values(rigCountByJob).reduce((s, n) => s + n, 0);
    const totalBudget = jobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const now = new Date();
    const weekEnd = addDays(now, 7);
    const startingThisWeek = jobs.filter(j => {
      if (!j.start_date) return false;
      try { const d = parseISO(j.start_date); return d >= now && d <= weekEnd; } catch { return false; }
    }).length;
    return [
      { icon: Briefcase, label: 'Total Projects', value: jobs.length, sublabel: `${active} active`, color: 'brand' },
      { icon: BarChart3, label: 'In Progress', value: inProgress, sublabel: 'On site now', color: 'emerald' },
      { icon: Users, label: 'Crew Deployed', value: totalCrew, sublabel: 'Across all jobs', color: 'blue' },
      { icon: Truck, label: 'Rigs In Use', value: totalRigs, sublabel: 'Active drilling', color: 'amber' },
      { icon: PoundSterling, label: 'Total Budget', value: totalBudget > 0 ? '£' + totalBudget.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—', sublabel: 'Portfolio value', color: 'violet' },
      { icon: Calendar, label: 'Starting Soon', value: startingThisWeek, sublabel: 'Next 7 days', color: 'teal' },
    ];
  }, [jobs, crewCountByJob, rigCountByJob]);
}