import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek } from 'date-fns';
import {
  Receipt, Camera, ScanLine, ClipboardList, CalendarClock, Clock,
  PoundSterling, ChevronRight, ShieldCheck, AlertTriangle, Inbox,
  LayoutDashboard, Users, Truck, HelpCircle,
} from 'lucide-react';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { useInbox } from '@/hooks/useInbox';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import TodayJobHero from './TodayJobHero';
import ReceiptCaptureModal from './ReceiptCaptureModal';
import { complianceDaysUntil } from '@/utils/complianceDate';

const fmtMoney = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0h';
};

/**
 * FieldDashboard — the redesigned personal cockpit for field staff.
 * Replaces the old card grid with a live stats overview, today's job hero,
 * quick-action chips, compliance pills, and upcoming shifts.
 */
export default function FieldDashboard() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { counts: inboxCounts } = useInbox();
  const {
    staff, isPlatformAdmin, todaysAssignments, upcomingAssignments,
    jobs, clients, myCompliance,
  } = ctx || {};

  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // This week's timesheets
  const { data: myTimesheets = [] } = useQuery({
    queryKey: ['my-week-timesheets', staff?.id, weekStart],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staff.id }),
    enabled: !!staff?.id,
  });

  // This week's daily costs (receipts)
  const { data: myCosts = [] } = useQuery({
    queryKey: ['my-week-costs', staff?.id, weekStart],
    queryFn: () => base44.entities.DailyCost.filter({ staff_id: staff.id }),
    enabled: !!staff?.id,
  });

  const weekTimesheets = useMemo(
    () => myTimesheets.filter(t => t.week_start === weekStart && t.status !== 'deleted' && t.status !== 'rejected' && t.status !== 'merged'),
    [myTimesheets, weekStart]
  );
  const weekCosts = useMemo(
    () => myCosts.filter(c => c.week_start === weekStart),
    [myCosts, weekStart]
  );

  const weekMinutes = weekTimesheets.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const weekHours = weekMinutes / 60;
  const hourlyRate = staff?.day_rate ? staff.day_rate / 8 : 0;
  const weekEarnings = weekHours * hourlyRate;
  const pendingReceipts = weekCosts.filter(c => c.status === 'submitted').length;
  const submittedCount = weekTimesheets.filter(t => t.status === 'submitted' || t.status === 'approved').length;

  // Compliance pills
  const complianceStats = useMemo(() => {
    const myItems = (myCompliance || []).filter(i => i.reference_id === staff?.id || i.reference_name === staff?.name);
    const expired = myItems.filter(i => {
      if (!i.expiry_date || i.status_override !== 'auto') return false;
      const days = complianceDaysUntil(i.expiry_date);
      return days !== null && days < 0;
    });
    const expiring = myItems.filter(i => {
      if (!i.expiry_date || i.status_override !== 'auto') return false;
      const days = complianceDaysUntil(i.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });
    return { expired: expired.length, expiring: expiring.length };
  }, [myCompliance, staff]);

  const todayCount = todaysAssignments?.length || 0;
  const upcomingCount = upcomingAssignments?.length || 0;
  const inboxCount = inboxCounts?.total || 0;
  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);

  // Today's next assignment for hero card
  const todaysSorted = [...(todaysAssignments || [])].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
  const nextAssignment = todaysSorted.find(a => (a.status || 'assigned') !== 'completed') || todaysSorted[0];
  const nextJob = jobs?.find(j => j.id === nextAssignment?.job_id);
  const nextClient = clients?.find(c => c.id === nextJob?.client_id);

  // Quick action chips
  const quickActions = [
    { id: 'receipt', label: 'Upload Receipt', icon: Camera, onClick: () => setShowReceiptModal(true), gradient: 'from-amber-500 to-orange-500' },
    { id: 'scan', label: 'Scan Asset', icon: ScanLine, onClick: () => navigate('/scanner'), gradient: 'from-[#2E5A1A] to-[#1c4a12]' },
    { id: 'tasks', label: 'My Tasks', icon: ClipboardList, onClick: () => navigate('/my-duties'), gradient: 'from-blue-500 to-blue-600' },
    { id: 'schedule', label: 'Schedule', icon: CalendarClock, onClick: () => navigate('/today-schedule'), gradient: 'from-teal-500 to-teal-600' },
  ];

  // Upcoming preview (next 3)
  const upcomingPreview = [...(upcomingAssignments || [])]
    .sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date))
    .slice(0, 3);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  })();

  return (
    <div className="min-h-full pb-6">
      {/* Greeting header */}
      <div className="px-4 sm:px-6 pt-4 pb-4">
        <div className="flex items-center gap-3">
          {staff?.avatar_url ? (
            <img src={staff.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white shadow-md" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-lg shadow-md">
              {(staff?.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-ui-caption text-slate-500 font-medium">{greeting}</p>
            <h1 className="text-ui-heading font-bold text-slate-900 truncate">{staff?.name || 'Field Crew'}</h1>
          </div>
          <div className="text-right">
            <p className="text-ui-caption text-slate-400">{format(new Date(), 'EEEE')}</p>
            <p className="text-sm font-bold text-slate-700">{format(new Date(), 'dd MMM')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-4">
        {/* Stats row — 3 gradient tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="stat-gradient-brand rounded-2xl p-3 text-white relative overflow-hidden">
            <Clock className="w-4 h-4 text-white/40 absolute top-2 right-2" />
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">Hours</p>
            <p className="text-xl font-extrabold mt-0.5 tabular-nums">
              <AnimatedNumber value={weekHours} format={v => fmtDur(v * 60)} />
            </p>
            <p className="text-[9px] text-white/60 mt-0.5">this week</p>
          </div>
          <div className="stat-gradient-emerald rounded-2xl p-3 text-white relative overflow-hidden">
            <PoundSterling className="w-4 h-4 text-white/40 absolute top-2 right-2" />
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">Earnings</p>
            <p className="text-xl font-extrabold mt-0.5 tabular-nums">
              {staff?.day_rate ? <AnimatedNumber value={weekEarnings} format={fmtMoney} /> : '—'}
            </p>
            <p className="text-[9px] text-white/60 mt-0.5">est. this week</p>
          </div>
          <div className={`rounded-2xl p-3 text-white relative overflow-hidden ${pendingReceipts > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate'}`}>
            <Receipt className="w-4 h-4 text-white/40 absolute top-2 right-2" />
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">Receipts</p>
            <p className="text-xl font-extrabold mt-0.5 tabular-nums">
              <AnimatedNumber value={pendingReceipts} />
            </p>
            <p className="text-[9px] text-white/60 mt-0.5">pending</p>
          </div>
        </div>

        {/* Today's job hero */}
        <TodayJobHero assignment={nextAssignment} job={nextJob} client={nextClient} staffName={staff?.name} />

        {/* Quick action chips */}
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map(qa => {
            const Icon = qa.icon;
            return (
              <button key={qa.id} onClick={qa.onClick} type="button"
                className="flex flex-col items-center gap-1.5 p-2.5 field-card active:scale-95 transition touch-manipulation">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${qa.gradient} flex items-center justify-center shadow-md`}>
                  <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{qa.label}</span>
              </button>
            );
          })}
        </div>

        {/* Compliance pills */}
        {(complianceStats.expired > 0 || complianceStats.expiring > 0) && (
          <button onClick={() => navigate('/staff-profile')} type="button"
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-95 ${complianceStats.expired > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${complianceStats.expired > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
              {complianceStats.expired > 0
                ? <AlertTriangle className="w-5 h-5 text-red-500" />
                : <ShieldCheck className="w-5 h-5 text-amber-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${complianceStats.expired > 0 ? 'text-red-900' : 'text-amber-900'}`}>
                {complianceStats.expired > 0 ? `${complianceStats.expired} expired compliance item${complianceStats.expired > 1 ? 's' : ''}` : `${complianceStats.expiring} expiring soon`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Tap to view in your profile</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {/* Upcoming shifts preview */}
        {upcomingPreview.length > 0 && (
          <div className="field-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-[#2E5A1A]" /> Upcoming
              </h3>
              <button onClick={() => navigate('/upcoming')} className="text-xs font-semibold text-[#2E5A1A] hover:underline">
                View all →
              </button>
            </div>
            <div className="space-y-2">
              {upcomingPreview.map(a => {
                const job = jobs?.find(j => j.id === a.job_id);
                const date = new Date(a.assigned_date + 'T00:00:00');
                const daysUntil = Math.ceil((date - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24));
                const label = daysUntil === 1 ? 'Tomorrow' : daysUntil === 0 ? 'Today' : `In ${daysUntil} days`;
                return (
                  <button key={a.id} onClick={() => navigate('/upcoming')} type="button"
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-left">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-[#2E5A1A] uppercase">{format(date, 'EEE')}</span>
                      <span className="text-sm font-bold text-slate-800">{format(date, 'dd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{job?.name || 'Shift'}</p>
                      <p className="text-xs text-slate-400">{label}{a.start_time ? ` · ${a.start_time}` : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Secondary navigation cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {inboxCount > 0 && (
            <button onClick={() => navigate('/inbox')} type="button"
              className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Inbox className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Inbox</p>
                <p className="text-xs text-slate-400">{inboxCount} pending</p>
              </div>
            </button>
          )}
          {staff?.delivery_dashboard_enabled && (
            <button onClick={() => navigate('/deliveries')} type="button"
              className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Deliveries</p>
                <p className="text-xs text-slate-400">Routes & drops</p>
              </div>
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => navigate('/admin')} type="button"
                className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-md flex-shrink-0">
                  <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Admin</p>
                  <p className="text-xs text-slate-400">Mission control</p>
                </div>
              </button>
              <button onClick={() => navigate('/manager-team')} type="button"
                className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">My Team</p>
                  <p className="text-xs text-slate-400">Overview</p>
                </div>
              </button>
            </>
          )}
          <button onClick={() => navigate('/staff-profile')} type="button"
            className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">My Profile</p>
              <p className="text-xs text-slate-400">Compliance & training</p>
            </div>
          </button>
          <button onClick={() => navigate('/help-field')} type="button"
            className="field-card p-3.5 flex items-center gap-3 active:scale-95 transition touch-manipulation">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-md flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">Help</p>
              <p className="text-xs text-slate-400">Guides & support</p>
            </div>
          </button>
        </div>
      </div>

      {/* Receipt capture modal */}
      <ReceiptCaptureModal
        open={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        staff={staff}
        assignment={nextAssignment}
        job={nextJob}
      />
    </div>
  );
}