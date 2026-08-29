import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, TrendingUp, ClipboardCheck, ShieldCheck, Car, AlertTriangle, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { computeStaffOvertime, buildRateMap, entryMinutes } from '@/utils/overtime';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};


export default function ManagerTimesheetApprovals({ staffId }) {
  const queryClient = useQueryClient();

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allAssignments = [] } = useQuery({ queryKey: ['all-assignments-mgr'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const l = await base44.entities.OvertimeSetting.list(); return l[0] || null; }
  });

  const reporters = allStaff.filter(s => s.manager_id === staffId);
  const reporterIds = reporters.map(s => s.id);
  const pending = timesheets.filter(t => reporterIds.includes(t.staff_id) && t.status === 'submitted');

  if (reporters.length === 0) return null;

  const rateMap = buildRateMap(overtimeRates);
  const threshold = overtimeSetting?.weekly_threshold_hours ?? 40;
  const breakdowns = {};
  reporters.forEach(s => {
    const entries = timesheets.filter(t => t.staff_id === s.id && (t.status === 'submitted' || t.status === 'approved'));
    breakdowns[s.id] = computeStaffOvertime(entries, rateMap, threshold);
  });

  const handleApprove = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
          <Zap className="w-3 h-3" /> Green-Path Active
        </span>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
            <ClipboardCheck className="w-3 h-3" /> {pending.length} need review
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No timesheets pending your approval right now.</p>
      ) : (
        <div className="space-y-3">
          {pending.map(t => {
            const member = allStaff.find(s => s.id === t.staff_id);
            const job = jobs.find(j => j.id === t.job_id);
            const b = breakdowns[t.staff_id]?.[t.id] || {};
            const mins = entryMinutes(t);
            return (
              <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                      <span className="text-[10px] text-slate-400">{format(new Date(t.date + 'T00:00:00'), 'dd MMM yyyy')}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 truncate">{job?.name || '—'} · {t.is_summary ? 'Daily Summary' : t.task_description}</p>
                    {t.is_summary && (t.on_site_minutes > 0 || (t.travel_to_minutes > 0 || t.travel_from_minutes > 0)) && (
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 flex-wrap">
                        {t.on_site_minutes > 0 && <span>On-site: {fmtDur(t.on_site_minutes)}</span>}
                        {(t.travel_to_minutes > 0 || t.travel_from_minutes > 0) && (
                          <span className="inline-flex items-center gap-0.5"><Car className="w-2.5 h-2.5" />Travel: {fmtDur((t.travel_to_minutes || 0) + (t.travel_from_minutes || 0))}{t.payable_travel_minutes > 0 ? ` (${fmtDur(t.payable_travel_minutes)} paid)` : ' (unpaid)'}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>
                      {b.isOvertime && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />OT {fmtDur(b.otMins)} ×{b.multiplier}</span>}
                      {(() => { const ra = allAssignments.find(a => a.staff_id === t.staff_id && a.job_id === t.job_id && a.assigned_date === t.date); return ra?.briefing_signed ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><ShieldCheck className="w-3 h-3" />Briefing {ra.briefing_signed_at ? format(new Date(ra.briefing_signed_at), 'HH:mm') : ''}</span> : null; })()}
                    </div>
                    {(() => {
                      const alerts = [];
                      const totalMins = t.is_summary ? (t.on_site_minutes || 0) + (t.travel_to_minutes || 0) + (t.travel_from_minutes || 0) + (t.break_minutes || 0) : mins;
                      const travelMins = (t.travel_to_minutes || 0) + (t.travel_from_minutes || 0);
                      if (totalMins > 600) alerts.push({ label: `${fmtDur(totalMins)} — long day`, cls: 'bg-amber-50 text-amber-700 ring-amber-200' });
                      if (travelMins > 90) alerts.push({ label: `Travel ${fmtDur(travelMins)}`, cls: 'bg-blue-50 text-blue-700 ring-blue-200' });
                      const ra = allAssignments.find(a => a.staff_id === t.staff_id && a.job_id === t.job_id && a.assigned_date === t.date);
                      if (ra && !ra.briefing_signed && !t.is_break) alerts.push({ label: 'No briefing signed', cls: 'bg-red-50 text-red-600 ring-red-200' });
                      if (alerts.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {alerts.map((a, i) => (
                            <span key={i} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ring-1 ${a.cls}`}>
                              <AlertTriangle className="w-2.5 h-2.5" /> {a.label}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleApprove(t.id)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition touch-manipulation active:scale-95" title="Approve"><CheckCircle2 className="w-5 h-5" /></button>
                    <button onClick={() => handleReject(t.id)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition touch-manipulation active:scale-95" title="Reject"><XCircle className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}