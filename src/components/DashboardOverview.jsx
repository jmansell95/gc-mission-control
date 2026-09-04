import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Grid3x3, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import CommandCentreGrid from '@/components/dashboard/CommandCentreGrid';
import FieldPrioritiesWidget from '@/components/dashboard/FieldPrioritiesWidget';
import ExceptionMonitorWidget from '@/components/dashboard/ExceptionMonitorWidget';
import RigPerformanceWidget from '@/components/dashboard/RigPerformanceWidget';
import MissionControlStrip from '@/components/dashboard/MissionControlStrip';
import BoreholesInProgressWidget from '@/components/dashboard/BoreholesInProgressWidget';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import QuickActionBar from '@/components/dashboard/QuickActionBar';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import CommandJobModal from '@/components/dashboard/CommandJobModal';
import DashboardStatsBar from '@/components/dashboard/DashboardStatsBar';
import PageHeader from '@/components/PageHeader';
import HubQuickLinks from '@/components/hubs/HubQuickLinks';
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

  // Block renderers — each block ID maps to its component. All blocks are
  // self-contained (fetch their own data) so the CommandCentreGrid can
  // drag/resize/hide them without any data plumbing from this page.
  const blockRenderers = {
    'rigs-on-site':        () => <RigPerformanceWidget onJobBreakdown={(job) => onSelectJob?.(job, 'financials')} />,
    'site-snapshot':       () => <SiteSnapshotGrid onSelectJob={openJobDrawer} onNavigate={onNavigate} />,
    'mission-control':    () => <MissionControlStrip onNavigate={onNavigate} />,
    'field-priorities':    () => <FieldPrioritiesWidget onNavigate={onNavigate} />,
    'exception-monitor':   () => <ExceptionMonitorWidget onNavigate={onNavigate} />,
    'boreholes-progress': () => <BoreholesInProgressWidget onNavigate={onNavigate} />,
  };

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
    <div className="space-y-6">
      {/* ── Premium Hero Header ── */}
      {isAllJobs && (
        <div className="hero-vibrant rounded-3xl px-6 py-7 lg:px-8 lg:py-8 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium mb-1">{format(new Date(), 'EEEE do MMMM yyyy')}</p>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">{headerTitle}</h1>
              <p className="text-white/80 text-sm mt-1.5">Mission Control — Ground Control operations command centre</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button onClick={() => onNavigate?.('jobs')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold transition ring-1 ring-white/20">
                <Briefcase className="w-4 h-4" /> Projects
              </button>
              <button onClick={() => onNavigate?.('rota')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold transition ring-1 ring-white/20">
                <Grid3x3 className="w-4 h-4" /> Scheduling
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Standardized PageHeader (for selected-job mode) ── */}
      {!isAllJobs && (
        <PageHeader
          icon={headerIcon}
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={selectedJob ? (
            <div className="flex items-center gap-2">
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
            </div>
          ) : null}
        />
      )}

      {/* ── Cross-hub quick links ── */}
      {isAllJobs && <div className="mb-1"><HubQuickLinks /></div>}

      {/* ── Standardized KPI strip ── */}
      {isAllJobs && (
        <div className="mb-1">
          <DashboardStatsBar onNavigate={onNavigate} />
        </div>
      )}

      {/* ── Quick Action Bar ── */}
      {isAllJobs && (
        <div className="mb-2">
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

      <div className="pt-2">
        <JobSelectorBar onSelectJob={onSelectJob} />
      </div>

      {/* ── Command Centre — customisable widget grid ── */}
      {isAllJobs && (
        <div className="mt-6">
          <CommandCentreGrid blockRenderers={blockRenderers} />
        </div>
      )}

      {/* Job Quick Drawer — slide-out drill-down without leaving the dashboard */}
      <JobQuickDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onOpenFullDetails={onSelectJob} />

      {/* Command Job Modal — full JobDetail in a centered pop-up (from snapshot grid) */}
      <CommandJobModal job={modalJob} onClose={() => setModalJob(null)} />
    </div>
  );
}