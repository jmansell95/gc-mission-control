import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2, Circle, CalendarDays, PenLine, ShieldCheck,
  ChevronLeft, ChevronRight, TrendingUp, Ruler, Car,
} from 'lucide-react';
import { computeStaffOvertime, buildRateMap, entryMinutes } from '@/utils/overtime';
import { fmtDur, getWeekSignatures, computeWeekStatus, buildWeekDates, groupByDate, DAY_LABELS } from '@/utils/timesheetHelpers';
import WeeklySignOffModal from './WeeklySignOffModal';

const dayStatus = (entries) => {
  if (!entries || entries.length === 0) return { key: 'none', label: 'No entry', Icon: Circle, color: 'text-slate-300', bg: 'bg-slate-50', ring: 'ring-slate-100' };
  const hasMerged = entries.some((e) => e.status === 'merged');
  const hasApproved = entries.some((e) => e.status === 'approved');
  const hasSubmitted = entries.some((e) => e.status === 'submitted');
  const hasDraft = entries.some((e) => e.status === 'draft');
  if (hasMerged && !hasSubmitted && !hasApproved) return { key: 'merged', label: 'Merged', Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' };
  if (hasApproved) return { key: 'approved', label: 'Approved', Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' };
  if (hasSubmitted) return { key: 'submitted', label: 'Submitted', Icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' };
  if (hasDraft) return { key: 'draft', label: 'Draft', Icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', ring: 'ring-slate-200' };
  return { key: 'none', label: 'No entry', Icon: Circle, color: 'text-slate-300', bg: 'bg-slate-50', ring: 'ring-slate-100' };
};

/**
 * StaffWeeklySignCard — the staff member's own weekly timesheet card with
 * self-sign capability. Shows all days of the week, lets the staff review
 * their daily summaries, and draw their signature to declare the week is
 * accurate. Once signed, the week enters the manager review queue.
 */
export default function StaffWeeklySignCard({ staffId, staffName }) {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [signOpen, setSignOpen] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [signing, setSigning] = useState(false);

  // Compute week start
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff + weekOffset * 7);
    return format(monday, 'yyyy-MM-dd');
  })();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['staff-timesheets', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId }, '-date', 200),
    enabled: !!staffId,
  });

  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const l = await base44.entities.OvertimeSetting.list(); return l[0] || null; },
  });

  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;

  // Filter to this week's daily summaries
  const weekEntries = timesheets.filter((t) => t.week_start === weekStart && t.is_summary);
  const status = computeWeekStatus(weekEntries, signatures);

  // Fetch signatures for this week
  useEffect(() => {
    let alive = true;
    (async () => {
      const sigs = await getWeekSignatures(weekStart, staffId);
      if (alive) setSignatures(sigs);
    })();
    return () => { alive = false; };
  }, [weekStart, staffId, signing]);

  const weekDates = buildWeekDates(weekStart);
  const byDate = groupByDate(weekEntries);
  const dayStates = weekDates.map((date, i) => ({
    date,
    label: DAY_LABELS[i],
    entries: byDate[date] || [],
    status: dayStatus(byDate[date] || []),
  }));

  const workedDays = dayStates.filter((d) => d.entries.length > 0);
  const countedEntries = weekEntries.filter((t) => t.status === 'approved' || t.status === 'merged' || t.is_weekly_summary);
  const totalMins = countedEntries.reduce((s, t) => s + entryMinutes(t), 0);
  const otBreakdown = computeStaffOvertime(weekEntries, otRateMap, otThreshold);
  const otMins = countedEntries.reduce((s, t) => s + (otBreakdown[t.id]?.otMins || 0), 0);
  const meterage = countedEntries.reduce((s, t) => s + (Number(t.meterage) || 0), 0);

  const weekEndDate = new Date(weekStart + 'T00:00:00');
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const canSign = workedDays.length > 0 && !status.staffSigned && !status.isMerged;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="hero-gradient px-4 py-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">My Weekly Timesheet</h2>
            <p className="text-emerald-100 text-xs">{format(new Date(weekStart + 'T00:00:00'), 'dd MMM')} – {format(weekEndDate, 'dd MMM yyyy')}</p>
          </div>
        </div>
        {/* Week navigator */}
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition touch-manipulation active:scale-95">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0} className="p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition disabled:opacity-30 touch-manipulation active:scale-95">
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-emerald-100 hover:text-white font-medium ml-1 px-2 py-2 touch-manipulation">This week</button>
          )}
        </div>
      </div>

      {/* Day chips */}
      <div className="px-4 py-3 grid grid-cols-7 gap-1.5">
        {dayStates.map((d) => {
          const { status: s } = d;
          const Icon = s.Icon;
          return (
            <div key={d.date} className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ring-1 ${s.bg} ${s.ring}`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase">{d.label}</span>
              <Icon className={`w-4 h-4 ${s.color}`} />
              <span className={`text-[9px] font-medium ${s.color} text-center leading-tight`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      {workedDays.length > 0 && (
        <div className="px-4 py-3 grid grid-cols-3 gap-2 border-t border-slate-100">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Total Hours</p>
            <p className="text-base font-bold text-slate-900 tabular-nums">{fmtDur(totalMins)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Overtime</p>
            <p className={`text-base font-bold tabular-nums ${otMins > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fmtDur(otMins)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Meterage</p>
            <p className={`text-base font-bold tabular-nums ${meterage > 0 ? 'text-violet-600' : 'text-slate-300'}`}>{meterage > 0 ? `${meterage}m` : '—'}</p>
          </div>
        </div>
      )}

      {/* Daily details */}
      {workedDays.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Daily Summaries</p>
          {workedDays.map((d) => {
            const entries = d.entries.filter((t) => !t.is_weekly_summary);
            return entries.map((t) => {
              const ot = otBreakdown[t.id] || {};
              return (
                <div key={t.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex flex-col items-center flex-shrink-0 w-12">
                    <span className="text-xs font-bold text-slate-700">{format(new Date(d.date + 'T00:00:00'), 'EEE')}</span>
                    <span className="text-[10px] text-slate-400">{format(new Date(d.date + 'T00:00:00'), 'dd MMM')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{t.is_summary ? 'Daily Summary' : (t.task_description || '—')}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                      <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDur(t.task_duration_minutes)}</span>
                      {t.on_site_minutes > 0 && <span>On-site {fmtDur(t.on_site_minutes)}</span>}
                      {(t.travel_to_minutes > 0 || t.travel_from_minutes > 0) && (
                        <span className="inline-flex items-center gap-0.5"><Car className="w-3 h-3" />{fmtDur((t.travel_to_minutes || 0) + (t.travel_from_minutes || 0))}</span>
                      )}
                      {t.meterage > 0 && <span className="inline-flex items-center gap-0.5"><Ruler className="w-3 h-3" />{t.meterage}m</span>}
                      {ot.isOvertime && <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />{fmtDur(ot.otMins)} ×{ot.multiplier}</span>}
                    </div>
                  </div>
                  <StatusChip status={t.status} />
                </div>
              );
            });
          })}
        </div>
      )}

      {/* Sign-off section */}
      <div className="px-4 py-3 border-t border-slate-100">
        {status.isMerged && status.managerSigned ? (
          <div className="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-4 py-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Week signed off</p>
              <p className="text-xs text-emerald-700">Your manager has approved and signed this week for payroll.</p>
            </div>
          </div>
        ) : status.staffSigned ? (
          <div className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-4 py-3">
            <PenLine className="w-5 h-5 text-blue-700 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-blue-900">Signed — awaiting manager approval</p>
              <p className="text-xs text-blue-700">Your manager has been notified. You'll see the signed-off badge once they approve.</p>
            </div>
          </div>
        ) : canSign ? (
          <button
            onClick={() => setSignOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-[0.98] transition text-sm font-bold touch-manipulation shadow-sm"
          >
            <PenLine className="w-5 h-5" /> Sign My Week
          </button>
        ) : workedDays.length === 0 ? (
          <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-3">
            <Circle className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <p className="text-sm text-slate-500">No entries this week. Complete your End of Shift to create daily summaries.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 bg-amber-50 rounded-xl px-4 py-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Submit your daily summaries via End of Shift before signing the week.</p>
          </div>
        )}
      </div>

      <WeeklySignOffModal
        open={signOpen}
        onClose={(signed) => {
          setSignOpen(false);
          if (signed) {
            setSigning((s) => !s);
            queryClient.invalidateQueries({ queryKey: ['staff-timesheets', staffId] });
          }
        }}
        staffMember={{ id: staffId, name: staffName }}
        weekStart={weekStart}
        weeklyRecord={status.weeklyRecord}
        currentUser={{ id: staffId, full_name: staffName }}
        tier="daily_worker"
        signerType="staff"
        title="Sign my weekly timesheet"
        description="By signing below you confirm the timesheet for this week is accurate and complete. Your signature will appear on the official PDF and your manager will be notified to review and approve."
        confirmLabel="Sign my week"
      />
    </div>
  );
}

function StatusChip({ status }) {
  const config = {
    submitted: { label: 'Submitted', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
    merged: { label: 'Merged', cls: 'bg-indigo-100 text-indigo-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  };
  const c = config[status] || config.submitted;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.cls}`}>{c.label}</span>;
}