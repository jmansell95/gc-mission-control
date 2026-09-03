import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Droplets, TestTube, Calculator, Layers, Mountain,
  ArrowDownToLine, ChevronRight, Tablet, Search, Boxes, Package, Gauge,
  Activity, TrendingDown, User, ExternalLink, CalendarDays, Clock
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { strataColors, strataConfig } from '@/components/investigation/shared';
import { getTotalMetres } from '@/utils/geotechBilling';
import { navigateToInvestigationHub } from '@/utils/investigationDeepLink';
import BoreholeDetailModal from '@/components/borehole/BoreholeDetailModal';
import BoreholeSummaryPanel from '@/components/borehole/BoreholeSummaryPanel';

export default function BoreholeDrillDown({ job, jobType }) {
  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  // Only show borehole data from KeyLogBook AGS imports — drillers record
  // borehole data in KeyLogBook, not manually in the app.
  const logs = useMemo(() => allLogs.filter(l => l.source === 'ags_import'), [allLogs]);

  // Strata is not required from AGS import for drilling jobs:
  //  - Rotary drilling: no strata and no samples (coring only)
  //  - Cable Percussive (CP): samples needed, but no strata
  const hideStrata = jobType === 'rotary_drilling' || jobType === 'cp_drilling';
  const hideSamples = jobType === 'rotary_drilling';

  // Group all AGS logs by borehole_ref
  const boreholes = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!l.borehole_ref) return;
      if (!map[l.borehole_ref]) map[l.borehole_ref] = [];
      map[l.borehole_ref].push(l);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [logs]);

  const [selectedRef, setSelectedRef] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return boreholes;
    const q = search.toLowerCase();
    return boreholes.filter(([ref]) => ref.toLowerCase().includes(q));
  }, [boreholes, search]);

  // Aggregate totals across all boreholes.
  // totalMeters uses the centralized getTotalMetres() from geotechBilling.js
  // — the SAME function used by the Billing Summary page — so the figure
  // shown here always matches every other view in the app.
  const totals = useMemo(() => {
    const totalMeters = getTotalMetres(logs);
    let totalSamples = 0;
    let totalSPTs = 0;
    let totalCores = 0;
    let totalInstallations = 0;
    let avgRecovery = null;
    const allRecoveries = [];
    let totalDrillingMinutes = 0;
    let sumDrillDepth = 0;
    let sumDrillHours = 0;
    const allDrillingDates = new Set();
    boreholes.forEach(([, refLogs]) => {
      const s = getBoreholeSummary(refLogs);
      totalSamples += s.sampleCount;
      totalSPTs += s.sptCount;
      totalCores += s.coreCount;
      totalInstallations += s.installCount;
      if (s.avgRecovery != null) allRecoveries.push(s.avgRecovery);
      totalDrillingMinutes += s.drillingMinutes || 0;
      (s.drillingDates || []).forEach(d => allDrillingDates.add(d));
      if ((s.drillingHours || 0) > 0 && s.maxDepth != null) {
        sumDrillDepth += s.maxDepth;
        sumDrillHours += s.drillingHours;
      }
    });
    if (allRecoveries.length) avgRecovery = Math.round(allRecoveries.reduce((a, b) => a + b, 0) / allRecoveries.length);
    const totalDrillingHours = Math.round((totalDrillingMinutes / 60) * 10) / 10;
    const totalDrillingDays = allDrillingDates.size;
    const avgDrillRate = sumDrillHours > 0 ? Math.round((sumDrillDepth / sumDrillHours) * 10) / 10 : null;
    return { totalMeters, totalSamples, totalSPTs, totalCores, totalInstallations, avgRecovery, totalDrillingHours, totalDrillingDays, avgDrillRate };
  }, [boreholes, logs]);

  const activeLogs = selectedRef ? boreholes.find(([ref]) => ref === selectedRef)?.[1] || [] : [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (boreholes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <EmptyState
          icon={Mountain}
          title="No borehole data"
          message="There is no borehole data in the system. Borehole data comes from KeyLogBook Sync or by uploading an AGS file via Settings → AGS Import."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BoreholeSummaryPanel boreholes={boreholes} totals={totals} />
      <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Mountain className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Borehole Data Explorer</h3>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
          <Tablet className="w-3 h-3" /> KeyLogBook
        </span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {boreholes.length} borehole{boreholes.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search borehole ref…"
            className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No boreholes match "{search}".</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(([ref, refLogs]) => {
              const s = getBoreholeSummary(refLogs);
              return (
                <div
                  key={ref}
                  className="group text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Header row */}
                  <button onClick={() => setSelectedRef(ref)} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition flex-shrink-0">
                        <Mountain className="w-4 h-4 text-emerald-700" />
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-base truncate">{ref}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
                    </div>
                  </button>

                  {/* Driller attribution — who logged/edited this borehole */}
                  {s.primaryDriller && (
                    <div className="flex items-center gap-1.5 mb-2 text-xs">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-emerald-700" />
                      </div>
                      <span className="font-semibold text-slate-700 truncate">{s.primaryDriller}</span>
                      {s.drillerCount > 1 && (
                        <span className="text-slate-400 text-[10px]">+{s.drillerCount - 1} other{s.drillerCount > 2 ? 's' : ''}</span>
                      )}
                    </div>
                  )}

                  {/* Brief summary line — depth, date range, log count */}
                  <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-500 flex-wrap">
                    {s.maxDepth != null && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-slate-600">
                        <ArrowDownToLine className="w-3 h-3 text-blue-500" />
                        {s.maxDepth}m
                      </span>
                    )}
                    {s.firstDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <CalendarDays className="w-3 h-3 text-slate-400" />
                        {s.lastDate && s.firstDate !== s.lastDate
                          ? `${s.firstDate.slice(5)}–${s.lastDate.slice(5)}`
                          : s.firstDate.slice(5)}
                      </span>
                    )}
                    <span className="text-slate-400">{s.totalLogs} {s.totalLogs === 1 ? 'record' : 'records'}</span>
                    {s.drillingHours > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-blue-600">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {s.drillingHours}h
                        {s.drillingDays > 1 && <span className="text-slate-400">· {s.drillingDays}d</span>}
                      </span>
                    )}
                  </div>

                  {/* Drilling rate — metres per hour */}
                  {s.drillingHours > 0 && s.maxDepth != null && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mb-2">
                      <Gauge className="w-3 h-3 text-emerald-600" />
                      {s.maxDepth}m in {s.drillingHours}h · {(s.maxDepth / s.drillingHours).toFixed(1)}m/h
                    </div>
                  )}

                  {/* Mini strata visual bar */}
                  {!hideStrata && s.strataLogs.length > 0 && (
                    <div className="mb-2">
                      <MiniStrataBar strataLogs={s.strataLogs} maxDepth={s.maxDepth} />
                    </div>
                  )}

                  {/* Core runs summary */}
                  {s.coreCount > 0 && (
                    <div className="mb-2 flex items-center gap-2 text-[11px] bg-fuchsia-50 rounded-md px-2 py-1">
                      <Boxes className="w-3 h-3 text-fuchsia-600 flex-shrink-0" />
                      <span className="font-semibold text-fuchsia-700">{s.coreCount} core run{s.coreCount !== 1 ? 's' : ''}</span>
                      {s.avgRecovery != null && (
                        <span className="text-fuchsia-600">· {s.avgRecovery}% rec</span>
                      )}
                      {s.avgRqd != null && (
                        <span className="text-fuchsia-600">· {s.avgRqd}% RQD</span>
                      )}
                    </div>
                  )}

                  {/* Data type chips */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] mb-2">
                    {!hideStrata && s.strataCount > 0 && (
                      <Chip icon={Layers} count={s.strataCount} color="amber" />
                    )}
                    {s.sptCount > 0 && (
                      <Chip icon={Calculator} count={s.sptCount} color="violet" />
                    )}
                    {s.coreCount > 0 && (
                      <Chip icon={Boxes} count={s.coreCount} color="fuchsia" />
                    )}
                    {!hideSamples && s.sampleCount > 0 && (
                      <Chip icon={TestTube} count={s.sampleCount} color="purple" />
                    )}
                    {s.installCount > 0 && (
                      <Chip icon={Package} count={s.installCount} color="emerald" />
                    )}
                    {s.waterReadingCount > 0 && (
                      <Chip icon={Gauge} count={s.waterReadingCount} color="teal" />
                    )}
                  </div>

                  {/* Link to Investigation Hub — deep-links pre-filtered to this job + borehole */}
                  <button
                    onClick={() => navigateToInvestigationHub(job.id, null, ref)}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-[#2E5A1A] font-medium py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> View in Investigation Hub
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedRef && (
        <BoreholeDetailModal
          boreholeRef={selectedRef}
          logs={activeLogs}
          jobType={jobType}
          jobId={job.id}
          boreholeRefs={filtered.map(([ref]) => ref)}
          onClose={() => setSelectedRef(null)}
          onNavigateRef={(ref) => setSelectedRef(ref)}
        />
      )}
      </div>
    </div>
  );
}

function Chip({ icon: Icon, count, color }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${colors[color]}`}>
      <Icon className="w-2.5 h-2.5" />{count}
    </span>
  );
}

// Mini horizontal strata bar — proportional colored segments showing strata distribution
function MiniStrataBar({ strataLogs, maxDepth }) {
  const top = maxDepth || Math.max(...strataLogs.map(l => l.depth_to || 0), 1);
  return (
    <div className="flex h-3 rounded-full overflow-hidden border border-slate-100 bg-slate-50">
      {strataLogs.map((l, i) => {
        const from = l.depth_from || 0;
        const to = l.depth_to || from;
        const width = ((to - from) / top) * 100;
        if (width <= 0) return null;
        const color = strataColors[l.strata_descriptor] || strataColors.other;
        const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
        return (
          <div
            key={l.id || i}
            style={{ width: `${width}%`, backgroundColor: color }}
            title={`${sc?.label || 'Strata'}: ${from}–${to}m`}
          />
        );
      })}
    </div>
  );
}

function SummaryStat({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-4 h-4 ${color}`} />
      <div>
        <p className="text-base font-bold text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function getBoreholeSummary(logs) {
  const progressLogs = logs.filter(l => l.log_type === 'borehole_progress' && !l.strata_description_detail);
  const strataLogs = logs.filter(l => l.strata_descriptor || l.strata_description_detail)
    .filter(l => l.log_type !== 'core_inspection')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const sampleLogs = logs.filter(l => l.log_type === 'sample_collection');
  const sptLogs = logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0));
  const coreLogs = logs.filter(l => l.log_type === 'core_inspection')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const installLogs = logs.filter(l => l.log_type === 'installation');
  const waterReadingLogs = logs.filter(l => l.log_type === 'standpipe_reading');

  const allDepths = [
    ...progressLogs.map(l => l.depth_to),
    ...strataLogs.map(l => l.depth_to),
    ...sptLogs.map(l => l.depth_to),
    ...coreLogs.map(l => l.depth_to),
  ].filter(d => d != null);

  const recoveries = coreLogs.map(l => l.coring_recovery).filter(r => r != null);
  const rqds = coreLogs.map(l => l.coring_rqd).filter(r => r != null);

  // Driller attribution: collect all distinct names from staff_name and
  // completed_by_name across every log for this borehole. The "logged by"
  // field shows who recorded the data — the actual driller name when
  // available, falling back to the import source label.
  const drillerNames = [...new Set(
    logs.map(l => l.staff_name).filter(n => n && n !== 'KeyLogBook Webhook' && !n.startsWith('AGS Import'))
  )];
  const primaryDriller = drillerNames[0] || null;
  const allDrillers = drillerNames.length > 0 ? drillerNames.join(', ') : null;

  // Drilling duration — sum of duration_minutes from driller activity logs
  // (source keylogbook_remarks with PTIM/DLOG times). Each activity's
  // duration_minutes is calculated from PTIM_DTIM start/end timestamps.
  const drillerActivityLogs = logs.filter(l =>
    l.source === 'keylogbook_remarks' && l.duration_minutes != null && l.duration_minutes > 0
  );
  const drillingMinutes = drillerActivityLogs.reduce((sum, l) => sum + l.duration_minutes, 0);
  const drillingDates = [...new Set(drillerActivityLogs.map(l => l.date).filter(Boolean))];
  const drillingHours = Math.round((drillingMinutes / 60) * 10) / 10;
  const drillingDays = drillingDates.length;

  // Date range: earliest → latest log date for this borehole
  const dates = logs.map(l => l.date).filter(Boolean).sort();
  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;

  return {
    maxDepth: allDepths.length ? Math.max(...allDepths) : null,
    groundwaterDepth: progressLogs[0]?.groundwater_strike_depth,
    type: progressLogs[0]?.completed_by_name?.replace('AGS Import (KeyLogBook)', '').trim() || null,
    imported_by: progressLogs[0]?.completed_by_name || null,
    sampleCount: sampleLogs.length,
    sptCount: sptLogs.length,
    strataCount: strataLogs.length,
    strataLogs,
    coreCount: coreLogs.length,
    installCount: installLogs.length,
    waterReadingCount: waterReadingLogs.length,
    avgRecovery: recoveries.length ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length) : null,
    avgRqd: rqds.length ? Math.round(rqds.reduce((a, b) => a + b, 0) / rqds.length) : null,
    primaryDriller,
    allDrillers,
    drillerCount: drillerNames.length,
    firstDate,
    lastDate,
    totalLogs: logs.length,
    drillingMinutes,
    drillingDates,
    drillingHours,
    drillingDays,
  };
}