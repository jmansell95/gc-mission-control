import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  X, Users, Drill, PoundSterling, CalendarClock, TrendingUp, Loader2,
  ChevronRight, AlertCircle, CheckCircle2, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';

const fmtMoney = (n) => '£' + Math.round(Number(n) || 0).toLocaleString('en-GB');
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_CONFIG = {
  planning: { label: 'Planning', pill: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', pill: 'bg-emerald-100 text-emerald-700' },
  on_hold: { label: 'On Hold', pill: 'bg-amber-100 text-amber-700' },
  decommissioning: { label: 'Decommissioning', pill: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Completed', pill: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', pill: 'bg-rose-100 text-rose-700' },
};

export default function RemainingWorkDrillDown({ job, asOfDate, onClose }) {
  const [finData, setFinData] = useState(null);
  const [loadingFin, setLoadingFin] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  // Load detailed financial breakdown (crew day rates, rig day rates) via calculateJobFinancials
  useEffect(() => {
    let active = true;
    setLoadingFin(true);
    base44.functions.invoke('calculateJobFinancials', { job_id: job.job_id })
      .then(res => { if (active) setFinData(res.data); })
      .catch(() => { if (active) setFinData(null); })
      .finally(() => { if (active) setLoadingFin(false); });
    return () => { active = false; };
  }, [job.job_id]);

  const sc = STATUS_CONFIG[job.status] || {};
  const monthlyData = job.monthly_projection || [];
  const positiveVariance = job.variance >= 0;
  const crewRows = finData?.cost_breakdown?.crew_rows || [];
  const rigRows = finData?.rig_profitability || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl h-full hub-glass shadow-2xl animate-drawer-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{job.job_name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.pill || ''}`}>
                  {sc.label || job.status}
                </span>
                {job.job_reference && <span className="text-[10px] text-slate-400">{job.job_reference}</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <span>{fmtDate(job.start_date)}</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span>{fmtDate(job.end_date)}</span>
            <span className="text-slate-300 mx-1">·</span>
            <span>Projection from {fmtDate(asOfDate)}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard icon={PoundSterling} label="Contracted Total" value={fmtMoney(job.contracted_total)} tone="slate" />
            <SummaryCard icon={TrendingUp} label="Earned to Date" value={fmtMoney(job.earned_to_date)} tone="emerald" />
            <SummaryCard icon={CalendarClock} label="Remaining Balance" value={fmtMoney(job.remaining_balance)} tone="amber" />
            <SummaryCard icon={TrendingUp} label="Projected Earnings" value={fmtMoney(job.projected_earnings)} tone="blue" />
          </div>

          {/* Variance banner */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${positiveVariance ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            {positiveVariance ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
            <div>
              <p className={`text-sm font-bold ${positiveVariance ? 'text-emerald-800' : 'text-rose-800'}`}>
                {positiveVariance ? 'On track to exceed contract' : 'Projected to fall short of contract'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Variance: <span className={`font-bold ${positiveVariance ? 'text-emerald-700' : 'text-rose-700'}`}>{positiveVariance ? '+' : ''}{fmtMoney(job.variance)}</span>
                {' '}· Daily run-rate: <span className="font-bold text-slate-700">{fmtMoney(job.daily_run_rate)}</span>
                {' '}· {job.remaining_working_days} working days remaining
              </p>
            </div>
          </div>

          {/* Monthly projection chart */}
          <div className="insight-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900">Monthly Projected Earnings</h4>
              {job.using_fallback && (
                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                  Flat-rate fallback (no day rates found)
                </span>
              )}
            </div>
            {monthlyData.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No remaining months — job has ended or no end date set.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
                    <Tooltip
                      formatter={(v) => [fmtMoney(v), 'Projected']}
                      labelFormatter={(l) => `Month: ${l}`}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar dataKey="projected" radius={[6, 6, 0, 0]}>
                      {monthlyData.map((m, i) => (
                        <Cell key={i} fill={m.is_gap_month ? '#f59e0b' : i === 0 ? '#2E5A1A' : '#5A8C1E'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Per-month resource detail table */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                    Monthly Resource Breakdown — tap a month to see crew & rig detail
                  </p>
                  <div className="space-y-1.5">
                    {monthlyData.map((m, i) => {
                      const isExpanded = expandedMonths.has(i);
                      const hasGap = m.is_gap_month;
                      return (
                        <div key={i} className={`rounded-xl border ${hasGap ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                          <button
                            onClick={() => setExpandedMonths(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                            <span className="text-xs font-bold text-slate-700 flex-shrink-0 min-w-[70px]">{m.month}</span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{m.working_days}d</span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 flex-shrink-0">
                              <Users className="w-3 h-3" /> {m.crew_count || '—'}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 flex-shrink-0">
                              <Drill className="w-3 h-3" /> {m.rig_count || '—'}
                            </span>
                            {hasGap && (
                              <span className="text-[9px] text-amber-600 font-bold flex-shrink-0">⚠ NO CREW</span>
                            )}
                            <span className="ml-auto text-xs font-bold text-[#2E5A1A] tabular-nums flex-shrink-0">{fmtMoney(m.projected)}</span>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                              {/* Crew detail */}
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Crew ({m.crew_count})</p>
                                {m.crew_detail.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {m.crew_detail.map((c, ci) => (
                                      <div key={ci} className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-700 font-medium truncate">{c.staff_name}</span>
                                        <span className="text-slate-500 tabular-nums flex-shrink-0 ml-2">
                                          {c.day_rate > 0 ? `${fmtMoney(c.day_rate)}/day` : <span className="text-amber-500">No rate</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-amber-600">No crew scheduled this month — rota gap.</p>
                                )}
                              </div>
                              {/* Rig detail */}
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Rigs ({m.rig_count})</p>
                                {m.rig_detail.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {m.rig_detail.map((r, ri) => (
                                      <div key={ri} className="flex items-center justify-between text-[11px]">
                                        <div className="min-w-0">
                                          <span className="text-slate-700 font-medium truncate">{r.rig_name}</span>
                                          {r.rig_type && <span className="text-[9px] text-slate-400 ml-1 uppercase">{r.rig_type}</span>}
                                        </div>
                                        <span className="text-slate-500 tabular-nums flex-shrink-0 ml-2">
                                          {r.day_rate > 0 ? `${fmtMoney(r.day_rate)}/day` : <span className="text-amber-500">No rate</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400">No rigs active this month.</p>
                                )}
                              </div>
                              {/* Calculation summary */}
                              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                                <span>Daily rate: <span className="font-bold text-slate-700">{fmtMoney(m.daily_rate_total)}</span></span>
                                <span>× {m.working_days} days</span>
                                <span className="font-bold text-[#2E5A1A]">= {fmtMoney(m.projected)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Resources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Crew */}
            <div className="insight-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">People Assigned</h4>
                  <p className="text-[10px] text-slate-400">{job.people_assigned_count} crew member{job.people_assigned_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {loadingFin ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 text-slate-300 animate-spin" /></div>
              ) : crewRows.length > 0 ? (
                <div className="space-y-1.5">
                  {crewRows.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate">{c.staff_name}</span>
                      <span className="text-slate-500 tabular-nums flex-shrink-0 ml-2">{fmtMoney(c.day_rate)}/day</span>
                    </div>
                  ))}
                </div>
              ) : job.crew_names.length > 0 ? (
                <div className="space-y-1.5">
                  {job.crew_names.map((n, i) => (
                    <div key={i} className="text-xs text-slate-700 font-medium">{n}</div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No crew assigned yet.</p>
              )}
            </div>

            {/* Rigs */}
            <div className="insight-card rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Drill className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Rigs on Site</h4>
                  <p className="text-[10px] text-slate-400">{job.rigs_on_site_count} rig{job.rigs_on_site_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {loadingFin ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 text-slate-300 animate-spin" /></div>
              ) : rigRows.length > 0 ? (
                <div className="space-y-1.5">
                  {rigRows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className="text-slate-700 font-medium truncate">{r.rig_name}</span>
                        {r.rig_type && <span className="text-[10px] text-slate-400 ml-1 uppercase">{r.rig_type}</span>}
                      </div>
                      <span className="text-slate-500 tabular-nums flex-shrink-0 ml-2">{fmtMoney(r.day_rate)}/day</span>
                    </div>
                  ))}
                </div>
              ) : job.rig_names.length > 0 ? (
                <div className="space-y-1.5">
                  {job.rig_names.map((n, i) => (
                    <div key={i} className="text-xs text-slate-700 font-medium">{n}</div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No rigs assigned yet.</p>
              )}
            </div>
          </div>

          {/* Run-rate analysis */}
          <div className="insight-card rounded-2xl p-4">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Run-Rate Analysis</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Working Days</p>
                <p className="text-lg font-extrabold text-slate-900 mt-0.5">{job.total_working_days}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Days Elapsed</p>
                <p className="text-lg font-extrabold text-slate-900 mt-0.5">{job.elapsed_working_days}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Days Remaining</p>
                <p className="text-lg font-extrabold text-slate-900 mt-0.5">{job.remaining_working_days}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Daily Run-Rate</p>
                <p className="text-lg font-extrabold text-[#2E5A1A] mt-0.5">{fmtMoney(job.daily_run_rate)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              {job.elapsed_working_days > 0 && job.earned_to_date > 0
                ? `Run-rate based on ${fmtMoney(job.earned_to_date)} earned over ${job.elapsed_working_days} working days.`
                : `Run-rate estimated from contracted total (${fmtMoney(job.contracted_total)}) spread across ${job.total_working_days} total working days — no earnings recorded yet.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 opacity-70" />}
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      </div>
      <p className="text-lg font-extrabold truncate">{value}</p>
    </div>
  );
}