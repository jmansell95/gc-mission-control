import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, PoundSterling, Loader2, Search, Trophy,
  ChevronDown, ChevronRight, Briefcase, TrendingUp, ArrowRight,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * CrewEarningsView — manager picks a date range and optional team,
 * sees total earned by crew with per-job breakdown.
 */
export default function CrewEarningsView({ dateRange, onSelectJob }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['crew-earnings', dateRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCrewEarnings', dateRange);
      return res.data || res;
    },
  });

  const crews = useMemo(() => {
    if (!data?.crews) return [];
    if (!search) return data.crews;
    const q = search.toLowerCase();
    return data.crews.filter(c => (c.team_name || '').toLowerCase().includes(q));
  }, [data, search]);

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!data?.crews || data.crews.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No crew earnings in this period</p>
        <p className="text-xs text-slate-400 mt-1">Assign teams to jobs and populate AFPs to see earnings.</p>
      </div>
    );
  }

  const totals = data.totals || {};

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <KPICard icon={PoundSterling} label="Total Earned" value={fmt(totals.total_earned)} gradient="stat-gradient-brand" />
        <KPICard icon={Users} label="Active Crews" value={totals.crews_count || 0} gradient="stat-gradient-blue" />
        <KPICard icon={TrendingUp} label="Avg per Crew" value={fmt(totals.crews_count ? totals.total_earned / totals.crews_count : 0)} gradient="stat-gradient-violet" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search crews…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2.5">
        {crews.map((crew, i) => {
          const isOpen = expanded.has(crew.team_id);
          return (
            <div key={crew.team_id} className="hub-glass rounded-2xl overflow-hidden">
              <button
                onClick={() => toggle(crew.team_id)}
                className="w-full p-3.5 flex items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {i === 0 && crew.total_earned > 0 ? (
                    <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{crew.team_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase">{crew.job_type} · {crew.jobs_count} jobs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-emerald-700 text-sm tabular-nums">{fmt(crew.total_earned)}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {isOpen && crew.job_breakdown && (
                <div className="px-3.5 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
                  {crew.job_breakdown.map((jb, j) => (
                    <button
                      key={j}
                      onClick={() => onSelectJob?.(jb.job_id)}
                      className="w-full flex items-center justify-between gap-2 text-xs py-1 hover:bg-emerald-50/50 rounded-lg px-1.5 transition group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600 truncate">{jb.job_name}</span>
                        {jb.job_reference && <span className="text-[9px] text-slate-400">({jb.job_reference})</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="font-semibold text-slate-700 tabular-nums">{fmt(jb.earned)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-primary transition" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hub-glass rounded-2xl overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-2.5 font-semibold">Rank</th>
                <th className="text-left px-3 py-2.5 font-semibold">Crew / Team</th>
                <th className="text-center px-3 py-2.5 font-semibold">Discipline</th>
                <th className="text-right px-3 py-2.5 font-semibold">Jobs</th>
                <th className="text-right px-3 py-2.5 font-semibold">Total Earned</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {crews.map((crew, i) => (
                <React.Fragment key={crew.team_id}>
                  <tr
                    onClick={() => toggle(crew.team_id)}
                    className="hover:bg-emerald-50/30 cursor-pointer transition"
                  >
                    <td className="px-3 py-2.5">
                      {i === 0 && crew.total_earned > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <Trophy className="w-3 h-3" /> {i + 1}
                        </span>
                      ) : (
                        <span className="text-slate-400 tabular-nums">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{crew.team_name}</td>
                    <td className="text-center px-3 py-2.5 text-slate-500 uppercase text-[10px]">{crew.job_type || '—'}</td>
                    <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{crew.jobs_count}</td>
                    <td className="text-right px-3 py-2.5 font-bold text-emerald-700 tabular-nums">{fmt(crew.total_earned)}</td>
                    <td className="px-3 py-2.5">
                      {expanded.has(crew.team_id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </td>
                  </tr>
                  {expanded.has(crew.team_id) && crew.job_breakdown && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Job Breakdown — click to open job</p>
                          {crew.job_breakdown.map((jb, j) => (
                            <button
                              key={j}
                              onClick={() => onSelectJob?.(jb.job_id)}
                              className="w-full flex items-center justify-between gap-2 text-xs py-0.5 hover:bg-emerald-50/50 rounded-lg px-1.5 transition group"
                            >
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-600">{jb.job_name}</span>
                                {jb.job_reference && <span className="text-[9px] text-slate-400">({jb.job_reference})</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-slate-700 tabular-nums">{fmt(jb.earned)}</span>
                                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-primary transition" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
              <tr className="font-bold text-slate-800">
                <td colSpan={4} className="px-3 py-2.5">Total ({crews.length} crews)</td>
                <td className="text-right px-3 py-2.5 text-emerald-700 tabular-nums">{fmt(totals.total_earned)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, gradient }) {
  return (
    <div className="hub-glass rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-[0.08]`} />
      <div className={`relative w-9 h-9 rounded-lg ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="relative text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}