import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays, ScanLine, ClipboardList, UserCircle, Wrench,
  Inbox, MapPin, Clock, Truck, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import FieldGreetingHeader from '@/components/field/FieldGreetingHeader';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { useInbox } from '@/hooks/useInbox';
import { staggerContainer, slideUp, bounceTap } from '@/lib/fieldAnimations';

/**
 * FieldHomeHub — the premium field crew home screen at /staff-schedule.
 *
 * Shows a "My Day" summary (today's primary job), quick-action cards,
 * upcoming preview, and alerts — all in the unified field design language.
 * The bottom navigation (Home, Today, Scan, Tools, More) is provided by
 * FieldShell → MobileNavShell → FieldBottomNav.
 */
export default function FieldHomeHub() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { staff, isPlatformAdmin, activeDivision, todaysAssignments, upcomingAssignments, jobs, clients, rigs } = ctx || {};
  const { counts: inboxCounts } = useInbox();

  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);
  const inboxCount = inboxCounts?.total || 0;

  // Today's primary job (first assignment of the day)
  const primaryJob = useMemo(() => {
    if (!todaysAssignments?.length) return null;
    const assignment = todaysAssignments[0];
    const job = jobs?.find((j) => j.id === assignment.job_id);
    const client = job?.client_id ? clients?.find((c) => c.id === job.client_id) : null;
    const rig = assignment.rig_asset_id ? rigs?.find((r) => r.id === assignment.rig_asset_id) : null;
    return { assignment, job, client, rig };
  }, [todaysAssignments, jobs, clients, rigs]);

  const stats = [
    { label: 'Today', value: todaysAssignments?.length || 0, icon: CalendarDays, gradient: 'stat-gradient-brand' },
    { label: 'Upcoming', value: upcomingAssignments?.length || 0, icon: Clock, gradient: 'stat-gradient-sky' },
    ...(inboxCount > 0 ? [{ label: 'Inbox', value: inboxCount, icon: Inbox, gradient: 'stat-gradient-rose' }] : []),
  ];

  const quickActions = [
    { label: 'Scan Asset', icon: ScanLine, path: '/scanner', gradient: 'stat-gradient-emerald' },
    { label: 'My Duties', icon: ClipboardList, path: '/my-duties', gradient: 'stat-gradient-amber' },
    { label: 'Field Tools', icon: Wrench, path: '/tools', gradient: 'stat-gradient-sky' },
    { label: 'My Profile', icon: UserCircle, path: '/staff-profile', gradient: 'stat-gradient-violet' },
    ...(staff?.delivery_dashboard_enabled ? [{ label: 'Deliveries', icon: Truck, path: '/deliveries', gradient: 'stat-gradient-blue' }] : []),
    ...(isAdmin ? [{ label: 'Inbox', icon: Inbox, path: '/inbox', gradient: 'stat-gradient-rose', badge: inboxCount }] : []),
  ];

  return (
    <div className="pb-6">
      <FieldGreetingHeader staff={staff} stats={stats} accentColor={activeDivision?.color} />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="px-4 sm:px-6 mt-4 space-y-4">
        {/* === My Day — Today's Primary Job === */}
        <motion.div variants={slideUp}>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-ui-subheading font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-[#2E5A1A]" />
              My Day
            </h2>
            {todaysAssignments?.length > 1 && (
              <button
                onClick={() => navigate('/today-schedule')}
                className="text-xs font-bold text-[#2E5A1A] flex items-center gap-0.5 active:scale-95 transition"
              >
                {todaysAssignments.length} jobs <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {primaryJob ? (
            <PrimaryJobCard data={primaryJob} onClick={() => navigate('/today-schedule')} />
          ) : (
            <EmptyDayCard isAdmin={isAdmin} />
          )}
        </motion.div>

        {/* === Quick Actions === */}
        <motion.div variants={slideUp}>
          <h2 className="text-ui-subheading font-bold text-slate-800 flex items-center gap-2 mb-2.5">
            <span className="w-1 h-5 rounded-full bg-[#2E5A1A]" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.label} action={action} onClick={() => navigate(action.path)} />
            ))}
          </div>
        </motion.div>

        {/* === Upcoming Preview === */}
        {upcomingAssignments?.length > 0 && (
          <motion.div variants={slideUp}>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-ui-subheading font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-[#2E5A1A]" />
                Coming Up
              </h2>
              <button
                onClick={() => navigate('/today-schedule')}
                className="text-xs font-bold text-[#2E5A1A] flex items-center gap-0.5 active:scale-95 transition"
              >
                All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {upcomingAssignments.slice(0, 3).map((assignment) => (
                <UpcomingRow key={assignment.id} assignment={assignment} job={jobs?.find((j) => j.id === assignment.job_id)} />
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// === Primary Job Card ===
function PrimaryJobCard({ data, onClick }) {
  const { assignment, job, client, rig } = data;
  const jobName = job?.name || 'Unassigned Job';
  const location = job?.location || assignment.site_location || '';
  const clientName = client?.name || '';
  const rigName = rig?.name || assignment.rig_name || '';

  return (
    <motion.button
      {...bounceTap}
      onClick={onClick}
      className="w-full field-card p-4 text-left touch-manipulation"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl stat-gradient-brand flex items-center justify-center shadow-md flex-shrink-0">
          <CalendarDays className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#2E5A1A] bg-[#2E5A1A]/10 px-2 py-0.5 rounded-full">
              {format(new Date(assignment.assigned_date + 'T00:00:00'), 'EEE dd MMM')}
            </span>
          </div>
          <h3 className="text-ui-heading font-bold text-slate-900 truncate">{jobName}</h3>
          {clientName && <p className="text-xs text-slate-500 truncate">{clientName}</p>}
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-3" />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {location && (
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-600 truncate max-w-[140px]">{location}</span>
          </div>
        )}
        {rigName && (
          <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <Wrench className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700 truncate max-w-[100px]">{rigName}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-bold text-[#2E5A1A]">View today's schedule</span>
        <div className="w-8 h-8 rounded-xl bg-[#2E5A1A]/10 flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-[#2E5A1A]" />
        </div>
      </div>
    </motion.button>
  );
}

// === Empty Day Card ===
function EmptyDayCard({ isAdmin }) {
  return (
    <div className="field-card p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <CalendarDays className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-ui-body font-bold text-slate-700 mb-1">No jobs scheduled today</h3>
      <p className="text-xs text-slate-500">
        {isAdmin ? 'Check the rota or contact your manager.' : 'Enjoy your day — check back later or contact your manager.'}
      </p>
    </div>
  );
}

// === Quick Action Card ===
function QuickActionCard({ action, onClick }) {
  const Icon = action.icon;
  return (
    <motion.button
      {...bounceTap}
      onClick={onClick}
      className="field-card p-4 flex flex-col items-center gap-2.5 text-center touch-manipulation relative"
    >
      <div className={`relative w-12 h-12 rounded-2xl ${action.gradient} flex items-center justify-center shadow-md`}>
        <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
        {action.badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
            {action.badge > 9 ? '9+' : action.badge}
          </span>
        )}
      </div>
      <span className="text-xs font-bold text-slate-700">{action.label}</span>
    </motion.button>
  );
}

// === Upcoming Row ===
function UpcomingRow({ assignment, job }) {
  const date = new Date(assignment.assigned_date + 'T00:00:00');
  return (
    <div className="field-card p-3 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-[9px] font-bold uppercase text-slate-400">{format(date, 'MMM')}</span>
        <span className="text-base font-extrabold text-slate-700 leading-none">{format(date, 'dd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{job?.name || 'Unassigned Job'}</p>
        <p className="text-xs text-slate-500 truncate">{job?.location || 'No location set'}</p>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase">{format(date, 'EEE')}</span>
    </div>
  );
}