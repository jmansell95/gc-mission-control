import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Briefcase, Grid3x3, Calendar, MapPin, Percent, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { GLOBAL_ONLY_WIDGETS } from '@/components/dashboard/registry';
import CustomisableWidgetGrid from '@/components/dashboard/CustomisableWidgetGrid';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import FieldPrioritiesWidget from '@/components/dashboard/FieldPrioritiesWidget';
import ExceptionMonitorWidget from '@/components/dashboard/ExceptionMonitorWidget';
import CommandCentreSection from '@/components/dashboard/CommandCentreSection';
import RigPerformanceWidget from '@/components/dashboard/RigPerformanceWidget';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import JobSelectorBar from '@/components/dashboard/JobSelectorBar';
import QuickActionBar from '@/components/dashboard/QuickActionBar';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import JobQuickDrawer from '@/components/dashboard/JobQuickDrawer';
import CommandJobModal from '@/components/dashboard/CommandJobModal';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';
import { useScopedEntity } from '@/hooks/useScopedEntity';

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const [drawerJob, setDrawerJob] = useState(null);
  const [modalJob, setModalJob] = useState(null);
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';
  const { data: staff = [] } = useScopedEntity('Staff', { queryKey: ['staff'], limit: 500 });
  const { data: vehicles = [] } = useScopedEntity('Vehicle', { queryKey: ['vehicles'], limit: 500 });
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['jobs'], limit: 500 });
  const { data: timesheets = [] } = useScopedEntity('Timesheet', { queryKey: ['timesheets'], sort: '-created_date', limit: 100 });
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: deliveries = [] } = useScopedEntity('DeliveryLog', { queryKey: ['deliveries', todayStr], filter: { scheduled_date: todayStr }, limit: 500 });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['safety-reports-open'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });
  const { isConnected: scConnected } = useMittiStatus();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useScopedEntity('RotaAssignment', { queryKey: ['rotas-this-week', weekStartStr], filter: { week_start: weekStartStr }, limit: 500 });

  const { data: todayRotasRaw = [] } = useScopedEntity('RotaAssignment', { queryKey: ['rotas-today', todayStr], filter: { assigned_date: todayStr }, limit: 500 });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || '';

  const titleCase = (s) => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : s;
  const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

  // Apply job filter to all dashboard data
  const scopedJobs = isAllJobs ? jobs : jobs.filter(j => j.id === selectedJobId);
  const scopedTimesheets = isAllJobs ? timesheets : timesheets.filter(t => t.job_id === selectedJobId);
  const scopedDeliveries = isAllJobs ? deliveries : deliveries.filter(d => d.job_id === selectedJobId);
  const scopedRotas = isAllJobs ? thisWeekRotas : thisWeekRotas.filter(r => r.job_id === selectedJobId);
  const scopedTodayRotas = isAllJobs ? todayRotasRaw : todayRotasRaw.filter(r => r.job_id === selectedJobId);

  const activeJobs = scopedJobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = scopedTodayRotas.filter(r => (r.assigned_date || '').slice(0, 10) === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;
  const pendingTs = scopedTimesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;

  const utilizationPct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;
  const nowMs = Date.now();
  const overdueSubmittedTs = scopedTimesheets.filter(t => t.status === 'submitted' && t.created_date && (nowMs - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;
  const overdueActions = scConnected ? safetyReports.flatMap(r => (r.action_items || [])).filter(a => a && a.due_date && new Date(a.due_date) < new Date()).length : 0;

  const openJobDrawer = (job) => setDrawerJob(job);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'field-priorities': return <FieldPrioritiesWidget onNavigate={onNavigate} />;
      case 'exception-monitor': return <ExceptionMonitorWidget onNavigate={onNavigate} />;
      case 'ai-insights': return <AiInsightsWidget onNavigate={onNavigate} />;
      default: return null;
    }
  };

  const canShowWidget = (id) => isAllJobs || !GLOBAL_ONLY_WIDGETS.includes(id);
  const selectedJob = !isAllJobs ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div>
      {/* Hero header — context-aware, responsive across mobile / tablet / desktop */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-4 mt-0">
        <div className="bg-white relative overflow-hidden rounded-t-none rounded-b-2xl md:rounded-2xl shadow-sm border border-slate-200/80 px-3 py-2.5 sm:px-5 sm:py-4 lg:px-6">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
          <div className="relative z-10 pl-2">
        {isAllJobs ? (
          /* ===== All Jobs mode ===== */
          <>
            {/* Mobile (<640px) — stacked rows, everything visible */}
            <div className="flex items-center gap-2.5 sm:hidden">
              <div className="p-1.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-lg flex-shrink-0 shadow-sm">
                <Grid3x3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight truncate flex-1">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:hidden">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex-1 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">{format(new Date(), 'EEEE do MMMM')}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-[#2E5A1A]/8 to-[#8DC63F]/8 border border-[#2E5A1A]/15 flex-shrink-0">
                <Calendar className="w-3.5 h-3.5 text-[#2E5A1A]" />
                <span className="text-sm font-bold text-[#2E5A1A] tabular-nums">{thisWeekRotas.length}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">{thisWeekRotas.length === 1 ? 'Shift' : 'Shifts'}</span>
              </div>
            </div>

            {/* Tablet (640px+) & Desktop (1024px+) — two-column inline */}
            <div className="hidden sm:flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 lg:p-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-xl flex-shrink-0 shadow-sm">
                  <Grid3x3 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-lg lg:text-xl xl:text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {greeting}{firstName ? `, ${firstName}` : ''}
                </h1>
              </div>
              <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
                <div className="flex flex-col items-end leading-tight">
                  <span className="text-sm font-bold text-slate-900">{format(new Date(), 'EEEE')}</span>
                  <span className="text-[11px] text-slate-500 font-medium">{format(new Date(), 'do MMMM yyyy')}</span>
                </div>
                <div className="h-9 w-px bg-slate-200" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#2E5A1A]/8 to-[#8DC63F]/8 border border-[#2E5A1A]/15">
                  <Calendar className="w-4 h-4 text-[#2E5A1A]" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-lg font-bold text-[#2E5A1A] tabular-nums">{thisWeekRotas.length}</span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{thisWeekRotas.length === 1 ? 'Shift' : 'Shifts'} This Week</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ===== Selected Job mode ===== */
          <>
            {/* Mobile (<640px) — stacked */}
            <div className="sm:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-lg flex-shrink-0 shadow-sm">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">{selectedJob?.name || 'Job'}</h1>
                  <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {selectedJob?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedJob.location}</span>}
                    {selectedJob?.start_date && selectedJob?.end_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(selectedJob.start_date), 'dd MMM')} – {format(new Date(selectedJob.end_date), 'dd MMM')}</span>
                    )}
                  </p>
                </div>
                {selectedJob?.status && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20 flex-shrink-0">
                    {titleCase(selectedJob.status.replace(/_/g, ' '))}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {gbp(selectedJob?.budget_amount) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium">Budget</span>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">{gbp(selectedJob.budget_amount)}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                  <Users className="w-3 h-3 text-[#2E5A1A]" />
                  <span className="text-xs font-bold text-slate-900 tabular-nums">{staffToday}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Crew</span>
                </span>
              </div>
            </div>

            {/* Tablet (640px+) & Desktop (1024px+) — two-column */}
            <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 lg:p-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-xl flex-shrink-0 shadow-sm">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg lg:text-xl xl:text-2xl font-bold text-slate-900 tracking-tight truncate">{selectedJob?.name || 'Job'}</h1>
                    {selectedJob?.status && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20">
                        {titleCase(selectedJob.status.replace(/_/g, ' '))}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                    {selectedJob?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedJob.location}</span>}
                    {selectedJob?.start_date && selectedJob?.end_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(selectedJob.start_date), 'dd MMM')} – {format(new Date(selectedJob.end_date), 'dd MMM yyyy')}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                {gbp(selectedJob?.budget_amount) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Budget</span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{gbp(selectedJob.budget_amount)}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <Users className="w-3.5 h-3.5 text-[#2E5A1A]" />
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{staffToday}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Crew Today</span>
                </span>
              </div>
            </div>
          </>
        )}
          </div>
        </div>
      </motion.div>

      {/* Quick Action Bar — one-click shortcuts for power users */}
      {isAllJobs && (
        <div className="mb-4">
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

      {/* Command Centre — stat tiles + Mission Control strip merged into one cohesive section */}
      {isAllJobs && (
        <CommandCentreSection
          onNavigate={onNavigate}
          monitors={[
            { key: 'active', icon: Briefcase, label: 'Active Jobs', value: activeJobs.length, sublabel: `${scopedJobs.length} total in system`, tone: 'emerald', nav: 'jobs', live: true },
            { key: 'util', icon: Percent, label: 'Crew Utilisation', value: utilizationPct, unit: '%', sublabel: `${staffToday} of ${activeStaff} active crew on site`, tone: 'blue', nav: 'rota', trend: staffToday > 0 ? 'up' : 'down' },
            { key: 'ts', icon: ClipboardCheck, label: 'Timesheet Queue', value: pendingTs, sublabel: overdueSubmittedTs > 0 ? `${overdueSubmittedTs} overdue (>48h)` : 'All within target', tone: overdueSubmittedTs > 0 ? 'rose' : 'amber', nav: { section: 'staff', staffTab: 'timesheets' }, trend: overdueSubmittedTs > 0 ? 'up' : null },
            { key: 'actions', icon: ShieldAlert, label: 'Overdue Actions', value: overdueActions, sublabel: scConnected ? (overdueActions > 0 ? 'Safety items past due' : 'No overdue safety actions') : 'SafetyCulture not connected', tone: overdueActions > 0 ? 'rose' : 'slate', nav: 'compliance', trend: overdueActions > 0 ? 'up' : 'down' },
          ]}
        />
      )}

      <JobSelectorBar onSelectJob={onSelectJob} />

      {/* Rig Performance — today's meterage & revenue per rig with crew */}
      {isAllJobs && (
        <div className="mb-4">
          <RigPerformanceWidget onJobBreakdown={(job) => onSelectJob?.(job, 'financials')} />
        </div>
      )}

      {/* Live Site Activity — visual snapshot grid of active sites */}
      {isAllJobs && (
        <SiteSnapshotGrid onSelectJob={openJobDrawer} onNavigate={onNavigate} />
      )}

      {/* Customisable widget grid — drag to reorder, toggle visibility */}
      <CustomisableWidgetGrid renderWidget={renderWidget} canShowWidget={canShowWidget} />

      {/* Job Quick Drawer — slide-out drill-down without leaving the dashboard */}
      <JobQuickDrawer job={drawerJob} onClose={() => setDrawerJob(null)} onOpenFullDetails={onSelectJob} />

      {/* Command Job Modal — full JobDetail in a centered pop-up (from snapshot grid) */}
      <CommandJobModal job={modalJob} onClose={() => setModalJob(null)} />
    </div>
  );
}