import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircle2, Clock, XCircle, Circle, CalendarDays, Download,
  Loader2, ChevronDown, ChevronRight, Merge, AlertTriangle, Ruler, TrendingUp, Car, User, ShieldCheck, PenLine,
} from 'lucide-react';
import { downloadWeeklyTimesheetPDF } from './WeeklyTimesheetPDF';
import { fetchSignaturesForWeek, markSignatureInjected } from '@/utils/signatureFlow';
import { fmtDur, getWeekSignatures, computeWeekStatus, buildWeekDates, groupByDate, DAY_LABELS } from '@/utils/timesheetHelpers';
import WeeklySignOffModal from './WeeklySignOffModal';

const dayStatus = (entries) => {
  if (!entries || entries.length === 0) return { key: 'none', label: 'No entry', Icon: Circle, color: 'text-slate-300', bg: 'bg-slate-50', ring: 'ring-slate-100' };
  const hasMerged = entries.some((e) => e.status === 'merged');
  const hasApproved = entries.some((e) => e.status === 'approved');
  const hasRejected = entries.some((e) => e.status === 'rejected');
  const hasSubmitted = entries.some((e) => e.status === 'submitted');
  const hasDraft = entries.some((e) => e.status === 'draft');
  if (hasMerged && !hasSubmitted && !hasApproved) return { key: 'merged', label: 'Merged', Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' };
  if (hasApproved) return { key: 'approved', label: 'Approved', Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' };
  if (hasRejected) return { key: 'rejected', label: 'Rejected', Icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', ring: 'ring-red-200' };
  if (hasSubmitted) return { key: 'submitted', label: 'Submitted', Icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' };
  if (hasDraft) return { key: 'draft', label: 'Draft', Icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', ring: 'ring-slate-200' };
  return { key: 'none', label: 'No entry', Icon: Circle, color: 'text-slate-300', bg: 'bg-slate-50', ring: 'ring-slate-100' };
};

export default function WeeklyTimesheetCard({ staffMember, weekStart, dailySummaries, jobs, otBreakdowns, currentUser }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [merging, setMerging] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [signatures, setSignatures] = useState([]);

  const weekDates = buildWeekDates(weekStart);
  const byDate = groupByDate(dailySummaries);

  const status = computeWeekStatus(dailySummaries, signatures);
  const { weeklyRecord, workedDays, allApproved, isMerged, staffSigned, managerSigned, readyToMerge } = status;

  const dayStates = weekDates.map((date, i) => {
    const entries = byDate[date] || [];
    return { date, label: DAY_LABELS[i], entries, status: dayStatus(entries) };
  });

  // Fetch signatures on mount and when entries change
  useEffect(() => {
    let alive = true;
    (async () => {
      const sigs = await getWeekSignatures(weekStart, staffMember?.id);
      if (alive) setSignatures(sigs);
    })();
    return () => { alive = false; };
  }, [weekStart, staffMember?.id, dailySummaries.length]);

  // Aggregate totals (from approved + merged entries)
  const countedEntries = dailySummaries.filter((t) => t.status === 'approved' || t.status === 'merged' || t.is_weekly_summary);
  const totalMins = countedEntries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const onSiteMins = countedEntries.reduce((s, t) => s + (Number(t.on_site_minutes) || 0), 0);
  const travelMins = countedEntries.reduce((s, t) => s + (Number(t.payable_travel_minutes) || 0), 0);
  const meterage = countedEntries.reduce((s, t) => s + (Number(t.meterage) || 0), 0);
  const otMins = countedEntries.reduce((s, t) => s + (otBreakdowns[t.id]?.otMins || 0), 0);

  const handleApproveDay = async (entryId) => {
    setApprovingId(entryId);
    try {
      await base44.entities.Timesheet.update(entryId, { status: 'approved', approved_by_name: currentUser?.full_name || '' });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    } catch { /* bubble */ }
    setApprovingId(null);
  };

  const handleRejectDay = async (entryId) => {
    await base44.entities.Timesheet.update(entryId, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
  };

  const handleMerge = async () => {
    if (!confirm(`Merge ${workedDays.length} approved day(s) into one weekly timesheet for ${staffMember?.name || 'this staff member'}? This locks the week for payroll.`)) return;
    setMerging(true);
    try {
      await base44.functions.invoke('mergeWeeklyTimesheet', { staff_id: staffMember.id, week_start: weekStart });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    } catch (e) { /* bubble */ }
    setMerging(false);
  };

  const handleDownload = async () => {
    // Fetch captured signatures for this week to inject into the PDF
    let employeeSignatureUrl = null, managerSignatureUrl = null;
    try {
      const sigs = await fetchSignaturesForWeek(weekStart, staffMember?.id);
      const emp = sigs.find((s) => s.tier === 'daily_worker');
      const mgr = sigs.find((s) => s.tier === 'weekly_official') || sigs.find((s) => s.tier === 'manager_approval');
      employeeSignatureUrl = emp?.signature_url;
      managerSignatureUrl = mgr?.signature_url;
      setSignatures(sigs);
    } catch { /* non-critical — fall back to blank lines */ }

    // Build daily entries with ALL jobs/tasks per day (not just entries[0])
    const dailyEntries = weekDates.map((date, i) => {
      const dayEntries = (byDate[date] || []).filter((t) => !t.is_weekly_summary && t.status !== 'deleted' && t.status !== 'rejected');
      const rows = dayEntries.map((entry) => {
        const ot = otBreakdowns[entry.id];
        const job = jobs.find((j) => j.id === entry?.job_id);
        return {
          jobName: job?.name || '—',
          taskDescription: entry?.task_description || '',
          onSiteMins: entry?.on_site_minutes || 0,
          travelMins: entry?.payable_travel_minutes || 0,
          totalMins: entry?.task_duration_minutes || 0,
          isOvertime: !!ot?.isOvertime,
          otMins: ot?.otMins || 0,
          otMultiplier: ot?.multiplier || 1,
          meterage: entry?.meterage || 0,
          status: entry?.status,
        };
      });
      return {
        dateStr: format(new Date(date + 'T00:00:00'), 'dd MMM'),
        dayLabel: DAY_LABELS[i],
        rows,
      };
    });

    await downloadWeeklyTimesheetPDF({
      staffName: staffMember?.name || 'Staff',
      staffRole: staffMember?.job_title,
      weekStart,
      dailyEntries,
      totals: { totalMins, onSiteMins, travelMins, otMins, meterage },
      approvedByName: weeklyRecord?.approved_by_name || currentUser?.full_name,
      employeeSignatureUrl,
      managerSignatureUrl,
    });
    // Mark injected signatures as recorded on the PDF
    try {
      const sigs = await fetchSignaturesForWeek(weekStart, staffMember.id);
      for (const s of sigs) {
        if (!s.pdf_injected && (s.tier === 'daily_worker' || s.tier === 'weekly_official' || s.tier === 'manager_approval')) {
          await markSignatureInjected(s.id);
        }
      }
    } catch { /* non-critical */ }
  };

  const weekEndDate = new Date(weekStart + 'T00:00:00');
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-700 font-bold text-sm">{(staffMember?.name || '?').charAt(0)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{staffMember?.name || 'Unknown'}</p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(weekStart + 'T00:00:00'), 'dd MMM')} – {format(weekEndDate, 'dd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Total</p>
            <p className="text-sm font-bold text-slate-900">{fmtDur(totalMins)}</p>
          </div>
          {otMins > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-medium">Overtime</p>
              <p className="text-sm font-bold text-amber-600">{fmtDur(otMins)}</p>
            </div>
          )}
          {meterage > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-medium">Meterage</p>
              <p className="text-sm font-bold text-violet-600">{meterage}m</p>
            </div>
          )}
          {isMerged && managerSigned ? (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-700 text-white px-2.5 py-1 rounded-full font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Signed off
            </span>
          ) : isMerged ? (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Merged
            </span>
          ) : readyToMerge ? (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready to merge
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
              <Clock className="w-3.5 h-3.5" /> {workedDays.filter((d) => d.status === 'submitted').length} pending
            </span>
          )}
        </div>
      </div>

      {/* Signature status badges */}
      <div className="px-4 sm:px-5 py-2 flex items-center gap-2 flex-wrap bg-slate-50/40 border-b border-slate-50">
        <SigStatusBadge signed={staffSigned} label="Staff signed" icon={PenLine} signedClass="bg-blue-100 text-blue-700" />
        <SigStatusBadge signed={managerSigned} label="Manager signed" icon={ShieldCheck} signedClass="bg-emerald-100 text-emerald-700" />
      </div>

      {/* Day chips */}
      <div className="px-4 sm:px-5 py-3 grid grid-cols-7 gap-1.5 sm:gap-2">
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

      {/* Action bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center gap-2 flex-wrap">
        {!isMerged && readyToMerge && (
          <button onClick={handleMerge} disabled={merging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 transition">
            {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5" />}
            Merge week
          </button>
        )}
        {isMerged && (
          <>
            <button onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            {!managerSigned && (
              <button onClick={() => setSignOffOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition">
                <ShieldCheck className="w-3.5 h-3.5" /> Official sign-off
              </button>
            )}
          </>
        )}
        {!isMerged && !readyToMerge && workedDays.length > 0 && (
          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Approve each day to unlock the weekly merge
          </span>
        )}
        {workedDays.length === 0 && (
          <span className="text-[11px] text-slate-400">No entries this week</span>
        )}
        <button onClick={() => setExpanded(!expanded)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? 'Hide details' : 'Show daily details'}
        </button>
      </div>

      {/* Daily details (expandable) */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {workedDays.map((d) => {
            const entries = d.entries.filter((t) => !t.is_weekly_summary);
            return entries.map((t) => {
              const job = jobs.find((j) => j.id === t.job_id);
              const ot = otBreakdowns[t.id] || {};
              return (
                <div key={t.id} className="px-4 sm:px-5 py-3 flex items-start gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex flex-col items-center flex-shrink-0 w-12">
                      <span className="text-xs font-bold text-slate-700">{format(new Date(d.date + 'T00:00:00'), 'EEE')}</span>
                      <span className="text-[10px] text-slate-400">{format(new Date(d.date + 'T00:00:00'), 'dd MMM')}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{job?.name || '—'}</p>
                      {t.is_summary ? (
                        <p className="text-xs text-slate-500 truncate">Daily summary{t.notes ? ` · ${t.notes.slice(0, 60)}` : ''}</p>
                      ) : (
                        <p className="text-xs text-slate-500 truncate">{t.task_description || '—'}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                        <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDur(t.task_duration_minutes)}</span>
                        {t.on_site_minutes > 0 && <span>On-site {fmtDur(t.on_site_minutes)}</span>}
                        {(t.travel_to_minutes > 0 || t.travel_from_minutes > 0) && (
                          <span className="inline-flex items-center gap-0.5"><Car className="w-3 h-3" />{fmtDur((t.travel_to_minutes || 0) + (t.travel_from_minutes || 0))}{t.payable_travel_minutes > 0 ? ` (${fmtDur(t.payable_travel_minutes)} paid)` : ''}</span>
                        )}
                        {t.meterage > 0 && <span className="inline-flex items-center gap-0.5"><Ruler className="w-3 h-3" />{t.meterage}m</span>}
                        {ot.isOvertime && <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />{fmtDur(ot.otMins)} ×{ot.multiplier}</span>}
                        {t.approved_by_name && <span className="inline-flex items-center gap-0.5 text-emerald-600"><User className="w-3 h-3" />{t.approved_by_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {t.status === 'submitted' && (
                      <>
                        <button onClick={() => handleApproveDay(t.id)} disabled={approvingId === t.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
                          {approvingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                        </button>
                        <button onClick={() => handleRejectDay(t.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {t.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    )}
                    {t.status === 'merged' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Merged
                      </span>
                    )}
                    {t.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      )}
      <WeeklySignOffModal
        open={signOffOpen}
        onClose={(signed) => {
          setSignOffOpen(false);
          if (signed) {
            // Refresh signatures
            (async () => {
              const sigs = await getWeekSignatures(weekStart, staffMember?.id);
              setSignatures(sigs);
            })();
            queryClient.invalidateQueries({ queryKey: ['timesheets'] });
            queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
          }
        }}
        staffMember={staffMember}
        weekStart={weekStart}
        weeklyRecord={weeklyRecord}
        currentUser={currentUser}
      />
    </div>
  );
}

function SigStatusBadge({ signed, label, icon: Icon, signedClass }) {
  if (signed) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${signedClass}`}>
        <Icon className="w-2.5 h-2.5" /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400">
      <Icon className="w-2.5 h-2.5" /> {label.replace('signed', '—')}
    </span>
  );
}