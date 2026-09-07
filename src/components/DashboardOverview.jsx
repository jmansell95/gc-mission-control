import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Grid3x3, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import BentoDashboard from '@/components/dashboard/BentoDashboard';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import QuickActionBar from '@/components/dashboard/QuickActionBar';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import CommandJobModal from '@/components/dashboard/CommandJobModal';

import HubHeader from '@/components/hubs/HubHeader';
import HubQuickLinks from '@/components/hubs/HubQuickLinks';
import HubOnboardingBanner from '@/components/hubs/HubOnboardingBanner';
import { DASHBOARD_HELP_TOPICS, DASHBOARD_ONBOARDING } from '@/components/dashboard/dashboardHelp';
import { useScopedEntity } from '@/hooks/useScopedEntity';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [drawerJob, setDrawerJob] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['jobs'], limit: 500 });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || '';

  const titleCase = (s) => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : s;
  const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

  const selectedJob = !isAllJobs ? jobs.find(j => j.id === selectedJobId) : null;

  const openJobDrawer = (job) => setDrawerJob(job);

  // ── Header content depends on whether we're in All Jobs or Selected Job mode ──
  const headerIcon = isAllJobs ? Grid3x3 : Briefcase;
  const headerTitle = isAllJobs
    ? `${greeting}${firstName ? `, ${firstName}` : ''}`
    : (selectedJob?.name || 'Job');
  const headerSubtitle = isAllJobs
    ? format(new Date(), 'EEEE do MMMM yyyy')
    : [selectedJob?.location, selectedJob?.start_date && selectedJob?.end_date
        ? `${format(new Date(selectedJob.start_date), 'dd MMM')} – ${format(new Date(selectedJob.end_date), 'dd MMM yyyy')}`
        : null].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-5">
      {/* ── Unified hub masthead (shared design system) ── */}
      <HubHeader
        icon={headerIcon}
        eyebrow={isAllJobs ? 'Mission Control' : 'Project Focus'}
        title={headerTitle}
        subtitle={isAllJobs ? 'Ground Control operations command centre' : headerSubtitle}
        breadcrumbs={isAllJobs ? undefined : [{ label: 'Command Centre', to: '/admin' }, { label: headerTitle }]}
        help={{ hubKey: 'dashboard', title: 'Command Centre — how it works', topics: DASHBOARD_HELP_TOPICS }}
        actions={isAllJobs ? (
          <>
            <button onClick={() => onNavigate?.('jobs')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#244715] active:scale-[0.97] transition shadow-sm">
              <Briefcase className="w-4 h-4" /> Projects
            </button>
            <button onClick={() => onNavigate?.('rota')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 active:scale-[0.97] transition">
              <Grid3x3 className="w-4 h-4" /> Scheduling
            </button>
          </>
        ) : (selectedJob ? (
          <>
            {selectedJob?.status && (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20">
                {titleCase(selectedJob.status.replace(/_/g, ' '))}
              </span>
            )}
            {gbp(selectedJob?.budget_amount) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Budget</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{gbp(selectedJob.budget_amount)}</span>
              </span>
            )}
          </>
        ) : null)}
      />

      {/* ── First-run guidance ── */}
      {isAllJobs && <HubOnboardingBanner hubKey="dashboard" {...DASHBOARD_ONBOARDING} />}

      {/* ── Cross-hub quick links ── */}
      {isAllJobs && <HubQuickLinks hubKey="/admin" />}

      {/* ── Quick Action Bar ── */}
      {isAllJobs && (
        <div>
          <QuickActionBar onAction={(action) => {
            if (action === 'new-job') onNavigate?.('jobs');
            else if (action === 'add-staff') onNavigate?.('staff');
            else if (action === 'raise-invoice') onNavigate?.('billing');
            else if (action === 'log-incident') onNavigate?.('compliance');
            else if (action === 'new-delivery') onNavigate?.('logistics');
            else if (action === 'add-asset') onNavigate?.('assets');
          }} />
        </div>
      )}

      <JobSelectorBar onSelectJob={onSelectJob} />

      {/* ── Bento Dashboard — fixed modern widget grid ── */}
      {isAllJobs && (
        <BentoDashboard
          onNavigate={onNavigate}
          onSelectJob={onSelectJob}
          onOpenJobDrawer={openJobDrawer}
          onJobBreakdown={(job) => onSelectJob?.(job, 'financials')}
        />
      )}

      {/* Job Quick Drawer — slide-out drill-down without leaving the dashboard */}
      <JobQuickDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onOpenFullDetails={onSelectJob} />

      {/* Command Job Modal — full JobDetail in a centered pop-up (from snapshot grid) */}
      <CommandJobModal job={modalJob} onClose={() => setModalJob(null)} />
    </div>
  );
}