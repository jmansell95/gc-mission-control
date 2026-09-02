import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Mountain, Layers, TestTube, Calculator, Package, Droplets,
  Ruler, ArrowDownToLine, Activity, TrendingDown, Gauge,
  AlertTriangle, Ban, Waves, ClipboardList, Boxes,
  Tablet, ExternalLink, User
} from 'lucide-react';
import {
  strataConfig, logTypeConfig, reviewStatusConfig,
  strataColors, sampleTypeConfig, getSptDensityLabel, safeFormatDate
} from '@/components/investigation/shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { navigateToInvestigationHub } from '@/utils/investigationDeepLink';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Mountain },
  { key: 'strata', label: 'Strata', icon: Layers },
  { key: 'core', label: 'Core Runs', icon: Boxes },
  { key: 'spt', label: 'SPT Tests', icon: Calculator },
  { key: 'samples', label: 'Samples', icon: TestTube },
  { key: 'installations', label: 'Installations', icon: Package },
  { key: 'groundwater', label: 'Groundwater', icon: Droplets },
  { key: 'other', label: 'Other Activity', icon: ClipboardList },
];

export default function BoreholeDetailModal({ boreholeRef, logs, jobType, jobId, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Strata is not required from AGS import for drilling jobs:
  //  - Rotary drilling: no strata and no samples (coring only)
  //  - Cable Percussive (CP): samples needed, but no strata
  const hideStrata = jobType === 'rotary_drilling' || jobType === 'cp_drilling';
  const hideSamples = jobType === 'rotary_drilling';
  const visibleTabs = TABS.filter(t => !((t.key === 'strata' && hideStrata) || (t.key === 'samples' && hideSamples)));

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const summary = useMemo(() => getBoreholeSummary(logs), [logs]);

  // Count data per tab for badges
  const tabCounts = useMemo(() => ({
    overview: null,
    strata: summary.strataCount,
    core: summary.coreCount,
    spt: summary.sptCount,
    samples: summary.sampleCount,
    installations: summary.installCount,
    groundwater: summary.waterReadingCount + (summary.progressLog?.groundwater_strike_depth != null ? 1 : 0),
    other: summary.otherCount,
  }), [summary]);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="hero-gradient px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Mountain className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white font-mono">{boreholeRef}</h2>
              {summary.progressLog?.source === 'ags_import' && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur">
                  <Tablet className="w-3 h-3" /> KeyLogBook
                </span>
              )}
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              {summary.dateRange}
              {summary.progressLog?.depth_to != null && ` · Final depth ${summary.progressLog.depth_to}m`}
            </p>
            {summary.primaryDriller && (
              <p className="text-xs text-white/60 mt-0.5 inline-flex items-center gap-1">
                <User className="w-3 h-3" /> Logged by {summary.primaryDriller}{summary.drillerCount > 1 ? ` +${summary.drillerCount - 1} other${summary.drillerCount > 2 ? 's' : ''}` : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="border-b border-slate-200 bg-slate-50/50 px-2 flex-shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-0.5 py-1.5 min-w-min">
            {visibleTabs.map(tab => {
              const count = tabCounts[tab.key];
              const hasData = count === null || count > 0;
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  disabled={!hasData}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : hasData
                        ? 'text-slate-600 hover:bg-slate-200/60'
                        : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {count != null && count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'overview' && <OverviewTab summary={summary} logs={logs} hideStrata={hideStrata} hideSamples={hideSamples} />}
          {activeTab === 'strata' && !hideStrata && <StrataTab logs={summary.strataLogs} maxDepth={summary.maxDepth} groundwaterDepth={summary.progressLog?.groundwater_strike_depth} />}
          {activeTab === 'core' && <CoreTab logs={summary.coreLogs} />}
          {activeTab === 'spt' && <SptTab logs={summary.sptLogs} />}
          {activeTab === 'samples' && !hideSamples && <SamplesTab logs={summary.sampleLogs} />}
          {activeTab === 'installations' && <InstallationsTab logs={summary.installLogs} />}
          {activeTab === 'groundwater' && <GroundwaterTab summary={summary} logs={logs} />}
          {activeTab === 'other' && <OtherTab logs={summary.otherLogs} />}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-2.5 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
          <span>
            {logs.filter(l => l.source === 'ags_import').length} of {logs.length} entries from KeyLogBook{summary.progressLog?.completed_by_name ? ` · imported by ${summary.progressLog.completed_by_name}` : ''}
          </span>
          <div className="flex items-center gap-3">
            {jobId && (
              <button
                onClick={() => { onClose(); navigateToInvestigationHub(jobId, null, boreholeRef); }}
                className="inline-flex items-center gap-1 text-[#2E5A1A] hover:text-[#1c4a12] font-medium transition"
              >
                <ExternalLink className="w-3 h-3" /> View in Investigation Hub
              </button>
            )}
            <span>{logs.length} total records</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ===== Summary helper =====
function getBoreholeSummary(logs) {
  const progressLogs = logs.filter(l => l.log_type === 'borehole_progress' && !l.strata_description_detail);
  const strataLogs = logs.filter(l => (l.strata_descriptor || l.strata_description_detail) && l.log_type !== 'core_inspection')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const sampleLogs = logs.filter(l => l.log_type === 'sample_collection')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const sptLogs = logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0))
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const coreLogs = logs.filter(l => l.log_type === 'core_inspection')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const installLogs = logs.filter(l => l.log_type === 'installation')
    .sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const waterReadingLogs = logs.filter(l => l.log_type === 'standpipe_reading')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const otherLogs = logs.filter(l =>
    l.log_type && !['borehole_progress', 'sample_collection', 'installation', 'core_inspection', 'standpipe_reading'].includes(l.log_type) &&
    !l.strata_descriptor && !l.strata_description_detail
  );

  const allDepths = [
    ...progressLogs.map(l => l.depth_to),
    ...strataLogs.map(l => l.depth_to),
    ...sptLogs.map(l => l.depth_to),
    ...sampleLogs.map(l => l.depth_from),
    ...coreLogs.map(l => l.depth_to),
    ...installLogs.map(l => l.depth_to),
  ].filter(d => d != null);

  const dates = logs.map(l => l.date).filter(Boolean).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const dateRange = startDate && endDate
    ? (endDate !== startDate ? `${safeFormatDate(startDate, 'dd MMM yyyy')} → ${safeFormatDate(endDate, 'dd MMM yyyy')}` : safeFormatDate(startDate, 'dd MMM yyyy'))
    : '';

  // Driller attribution — distinct staff names across all logs for this borehole.
  // Only staff_name (resolved from the rota) is used — completed_by_name now
  // holds the Project Engineer, not the driller, so it must not be included.
  const drillerNames = [...new Set(
    logs.map(l => l.staff_name).filter(n => n && n !== 'KeyLogBook Webhook' && !n.startsWith('AGS Import'))
  )];

  return {
    maxDepth: allDepths.length ? Math.max(...allDepths) : null,
    progressLog: progressLogs[0],
    strataLogs, sampleLogs, sptLogs, coreLogs, installLogs, waterReadingLogs, otherLogs,
    strataCount: strataLogs.length,
    sampleCount: sampleLogs.length,
    sptCount: sptLogs.length,
    coreCount: coreLogs.length,
    installCount: installLogs.length,
    waterReadingCount: waterReadingLogs.length,
    otherCount: otherLogs.length,
    dateRange,
    primaryDriller: drillerNames[0] || null,
    drillerCount: drillerNames.length,
  };
}

// ===== Overview Tab =====
function OverviewTab({ summary, logs, hideStrata, hideSamples }) {
  const s = summary;
  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiTile icon={ArrowDownToLine} label="Final Depth" value={s.progressLog?.depth_to != null ? `${s.progressLog.depth_to}m` : (s.maxDepth != null ? `${s.maxDepth}m` : '—')} color="bg-blue-50 text-blue-700" />
        <KpiTile icon={Droplets} label="Water Strike" value={s.progressLog?.groundwater_strike_depth != null ? `${s.progressLog.groundwater_strike_depth}m` : '—'} color="bg-cyan-50 text-cyan-700" />
        {!hideStrata && <KpiTile icon={Layers} label="Strata Runs" value={s.strataCount} color="bg-amber-50 text-amber-700" />}
        <KpiTile icon={Calculator} label="SPT Tests" value={s.sptCount} color="bg-violet-50 text-violet-700" />
        <KpiTile icon={Boxes} label="Core Runs" value={s.coreCount} color="bg-fuchsia-50 text-fuchsia-700" />
        {!hideSamples && <KpiTile icon={TestTube} label="Samples" value={s.sampleCount} color="bg-purple-50 text-purple-700" />}
        <KpiTile icon={Package} label="Installations" value={s.installCount} color="bg-emerald-50 text-emerald-700" />
        <KpiTile icon={Gauge} label="Water Readings" value={s.waterReadingCount} color="bg-teal-50 text-teal-700" />
      </div>

      {/* Visual strata column + geological summary */}
      {!hideStrata && s.strataLogs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Run Profile
                </p>
              </div>
              <StrataColumn strataLogs={s.strataLogs} maxDepth={s.maxDepth} groundwaterDepth={s.progressLog?.groundwater_strike_depth} />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5" /> Geology Summary ({s.strataCount})
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {s.strataLogs.slice(0, 8).map((l, i) => {
                  const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
                  const thickness = (l.depth_from != null && l.depth_to != null) ? (l.depth_to - l.depth_from).toFixed(2) : null;
                  return (
                    <div key={l.id || i} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="w-3 h-12 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: strataColors[l.strata_descriptor] || strataColors.other }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {sc && l.strata_descriptor !== 'other' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                          )}
                          <span className="text-xs text-slate-500 inline-flex items-center gap-0.5">
                            <Ruler className="w-2.5 h-2.5" />{formatDepthRange(l.depth_from, l.depth_to)}
                          </span>
                          {thickness && <span className="text-xs text-slate-400">· {thickness}m</span>}
                        </div>
                        {l.strata_description_detail && (
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed line-clamp-2">{l.strata_description_detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {s.strataLogs.length > 8 && (
                  <div className="px-3 py-2 text-xs text-slate-400 text-center">
                    +{s.strataLogs.length - 8} more — see Strata tab
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {logs.some(l => l.refusal_encountered || (l.drilling_fluid_loss && l.drilling_fluid_loss !== 'none')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {logs.filter(l => l.refusal_encountered).length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <p className="text-sm font-bold text-amber-900">Refusal Encountered</p>
              </div>
              {logs.filter(l => l.refusal_encountered).map((l, i) => (
                <p key={i} className="text-xs text-amber-800 inline-flex items-center gap-1">
                  <Ban className="w-3 h-3" /> At {l.depth_from != null ? `${l.depth_from}m` : 'unknown depth'}
                </p>
              ))}
            </div>
          )}
          {logs.filter(l => l.drilling_fluid_loss && l.drilling_fluid_loss !== 'none').length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Waves className="w-4 h-4 text-amber-700" />
                <p className="text-sm font-bold text-amber-900">Fluid Loss</p>
              </div>
              {logs.filter(l => l.drilling_fluid_loss && l.drilling_fluid_loss !== 'none').map((l, i) => (
                <p key={i} className="text-xs text-amber-800 inline-flex items-center gap-1">
                  <Waves className="w-3 h-3" /> {l.drilling_fluid_loss === 'total' ? 'Total' : 'Partial'} loss at {l.depth_from != null ? `${l.depth_from}m` : '—'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source attribution */}
      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
        <Tablet className="w-3.5 h-3.5" />
        {logs.filter(l => l.source === 'ags_import').length} of {logs.length} entries imported from KeyLogBook AGS · {logs.filter(l => l.source !== 'ags_import').length} logged in-app
      </div>
    </div>
  );
}

// ===== Strata Tab =====
function StrataTab({ logs, maxDepth, groundwaterDepth }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden sticky top-0">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Run Profile
              </p>
            </div>
            <StrataColumn strataLogs={logs} maxDepth={maxDepth} groundwaterDepth={groundwaterDepth} />
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5" /> Full Strata Detail ({logs.length})
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {logs.map((l, i) => {
                const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
                const thickness = (l.depth_from != null && l.depth_to != null) ? (l.depth_to - l.depth_from).toFixed(2) : null;
                return (
                  <div key={l.id || i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-3 h-16 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: strataColors[l.strata_descriptor] || strataColors.other }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {sc && l.strata_descriptor !== 'other' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                        )}
                        <span className="text-xs text-slate-500 inline-flex items-center gap-0.5 font-mono">
                          <Ruler className="w-2.5 h-2.5" />{formatDepthRange(l.depth_from, l.depth_to)}
                        </span>
                        {thickness && <span className="text-xs text-slate-400">· {thickness}m thick</span>}
                      </div>
                      {l.strata_description_detail && (
                        <p className="text-sm text-slate-700 leading-relaxed">{l.strata_description_detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Core Runs Tab =====
function CoreTab({ logs }) {
  if (logs.length === 0) return <EmptyTab icon={Boxes} message="No core runs recorded for this borehole." />;
  const avgRecovery = logs.filter(l => l.coring_recovery != null).reduce((sum, l) => sum + l.coring_recovery, 0) / (logs.filter(l => l.coring_recovery != null).length || 1);
  const avgRqd = logs.filter(l => l.coring_rqd != null).reduce((sum, l) => sum + l.coring_rqd, 0) / (logs.filter(l => l.coring_rqd != null).length || 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile icon={Boxes} label="Core Runs" value={logs.length} color="bg-fuchsia-50 text-fuchsia-700" />
        <KpiTile icon={Activity} label="Avg Recovery" value={avgRecovery ? `${avgRecovery.toFixed(0)}%` : '—'} color="bg-emerald-50 text-emerald-700" />
        <KpiTile icon={TrendingDown} label="Avg RQD" value={avgRqd ? `${avgRqd.toFixed(0)}%` : '—'} color="bg-amber-50 text-amber-700" />
        <KpiTile icon={Package} label="Boxed" value={logs.filter(l => l.core_box_number).length} color="bg-slate-50 text-slate-700" />
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Run</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Depth (m)</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Length</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Recovery</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">RQD</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Box</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l, i) => {
                const length = (l.depth_from != null && l.depth_to != null) ? (l.depth_to - l.depth_from).toFixed(2) : null;
                return (
                  <tr key={l.id || i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-fuchsia-700 text-sm">{l.core_run_number || `C${i + 1}`}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{l.depth_from ?? '?'}–{l.depth_to ?? '?'}m</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{length ? `${length}m` : '—'}</td>
                    <td className="px-4 py-2.5">
                      {l.coring_recovery != null ? (
                        <span className={`font-mono text-xs px-2 py-0.5 rounded-full font-medium ${
                          l.coring_recovery < 50 ? 'bg-red-100 text-red-700' : l.coring_recovery < 90 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{l.coring_recovery}%</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.coring_rqd != null ? (
                        <span className={`font-mono text-xs px-2 py-0.5 rounded-full font-medium ${
                          l.coring_rqd < 25 ? 'bg-red-100 text-red-700' : l.coring_rqd < 75 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{l.coring_rqd}%</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{l.core_box_number || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{l.strata_description_detail || l.description?.replace(/^Imported from KeyLogBook AGS — /, '') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== SPT Tab =====
function SptTab({ logs }) {
  if (logs.length === 0) return <EmptyTab icon={Calculator} message="No SPT tests recorded for this borehole." />;
  const chartData = logs.filter(l => l.depth_from != null && l.spt_n_value != null).map(l => ({ depth: l.depth_from, n: l.spt_n_value }));

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> N-Values vs Depth ({logs.length})
            </p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" dataKey="n" domain={[0, 'dataMax + 5']} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'N-value', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#64748b' }} />
                <YAxis type="number" dataKey="depth" reversed domain={[0, 'dataMax + 1']} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b', dy: 30 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v, name) => name === 'n' ? [`${v} (N-value)`, 'SPT'] : [`${v}m`, 'Depth']} labelFormatter={() => ''} />
                <Bar dataKey="n" radius={[0, 4, 4, 0]} fill="#3b82f6">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.n > 50 ? '#ef4444' : entry.n > 30 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 justify-center">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> N ≤ 30</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 30–50</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> N {'>'} 50</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Blow Count Detail ({logs.length})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Depth (m)</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Blows (per 75mm)</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">N-Value</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Density</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l, i) => (
                <tr key={l.id || i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-700 font-mono">{l.depth_from != null ? `${l.depth_from}m` : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{(l.spt_blows || []).length > 0 ? `[${l.spt_blows.join(', ')}]` : '—'}</td>
                  <td className="px-4 py-2.5">
                    {l.spt_n_value != null ? (
                      <span className={`font-bold font-mono px-2 py-0.5 rounded-full text-xs ${
                        l.spt_n_value > 50 ? 'bg-red-100 text-red-700' : l.spt_n_value > 30 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>{l.spt_n_value}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{l.spt_n_value != null ? getSptDensityLabel(l.spt_n_value) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== Samples Tab =====
function SamplesTab({ logs }) {
  if (logs.length === 0) return <EmptyTab icon={TestTube} message="No samples recorded for this borehole." />;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
          <TestTube className="w-3.5 h-3.5" /> Samples ({logs.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Sample ID</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Depth (m)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l, i) => {
              const stc = sampleTypeConfig[l.sample_type] || sampleTypeConfig.none;
              return (
                <tr key={l.id || i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono font-bold text-purple-700 text-sm">{l.sample_id || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{l.depth_from != null ? `${l.depth_from}m` : '—'}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stc.badge}`}>{stc.label}</span></td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{l.description?.replace(/^Imported from KeyLogBook AGS — /, '') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Installations Tab =====
function InstallationsTab({ logs }) {
  if (logs.length === 0) return <EmptyTab icon={Package} message="No installations recorded for this borehole." />;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Installations ({logs.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Pipe Ref</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Depth (m)</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l, i) => {
              const detail = l.description
                ? l.description.replace(/^Imported from KeyLogBook AGS — (installation pipe|standpipe)[^:]*:\s*/, '').replace(/\.$/, '')
                : '—';
              return (
                <tr key={l.id || i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono font-bold text-emerald-700 text-sm">{l.standpipe_ref || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{l.depth_from != null || l.depth_to != null ? `${l.depth_from ?? '?'}–${l.depth_to ?? '?'}m` : '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Groundwater Tab =====
function GroundwaterTab({ summary, logs }) {
  const s = summary;
  const readings = s.waterReadingLogs;
  const strikeDepth = s.progressLog?.groundwater_strike_depth;
  const staticLevel = s.progressLog?.groundwater_static_level;
  const hasData = strikeDepth != null || staticLevel != null || readings.length > 0;

  if (!hasData) return <EmptyTab icon={Droplets} message="No groundwater data recorded for this borehole." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {strikeDepth != null && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Droplets className="w-4 h-4 text-cyan-700" />
              <p className="text-sm font-bold text-cyan-900">Water Strike</p>
            </div>
            <p className="text-3xl font-bold text-cyan-700">{strikeDepth}m</p>
            <p className="text-xs text-cyan-600 mt-0.5">Depth to first groundwater encounter</p>
          </div>
        )}
        {staticLevel != null && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Gauge className="w-4 h-4 text-teal-700" />
              <p className="text-sm font-bold text-teal-900">Static Level</p>
            </div>
            <p className="text-3xl font-bold text-teal-700">{staticLevel}m</p>
            <p className="text-xs text-teal-600 mt-0.5">Stabilised groundwater level</p>
          </div>
        )}
      </div>

      {readings.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Monitoring Readings ({readings.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Standpipe</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Water Level (mBGL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readings.map((l, i) => (
                  <tr key={l.id || i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{safeFormatDate(l.date, 'dd MMM yyyy')}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-700 text-xs">{l.standpipe_ref || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold font-mono text-cyan-700 text-sm">{l.standpipe_reading_m != null ? `${l.standpipe_reading_m}m` : '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Other Activity Tab =====
function OtherTab({ logs }) {
  if (logs.length === 0) return <EmptyTab icon={ClipboardList} message="No other activity recorded for this borehole." />;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Other Activity ({logs.length})
        </p>
      </div>
      <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
        {logs.map((l, i) => {
          const ltc = logTypeConfig[l.log_type];
          const rc = reviewStatusConfig[l.manager_review_status || 'pending'];
          return (
            <div key={l.id || i} className="px-4 py-3 flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ltc?.badge || 'bg-slate-100 text-slate-600'}`}>
                {ltc?.label || l.log_type}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
              <span className="text-sm text-slate-600 flex-1 truncate">{l.description || l.strata_description_detail || '—'}</span>
              {l.depth_from != null && <span className="text-xs text-slate-400 font-mono">{l.depth_from}m</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Shared helpers =====
function formatDepthRange(from, to) {
  const hasFrom = from != null && from !== '';
  const hasTo = to != null && to !== '';
  if (hasFrom && hasTo) return `${from}–${to}m`;
  if (hasFrom) return `${from}m`;
  if (hasTo) return `${to}m`;
  return '—';
}

function KpiTile({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function EmptyTab({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// Visual strata column — vertical stack of colored blocks scaled by layer thickness
function StrataColumn({ strataLogs, maxDepth, groundwaterDepth }) {
  const top = maxDepth || Math.max(...strataLogs.map(l => l.depth_to || 0), 1);
  const totalHeight = 360;
  const pxPerM = totalHeight / top;

  return (
    <div className="flex p-3">
      <div className="w-10 flex-shrink-0 relative" style={{ height: totalHeight }}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const depth = (top * frac).toFixed(1);
          return (
            <div key={frac} className="absolute left-0 right-0 flex items-center" style={{ top: `${frac * 100}%` }}>
              <span className="text-[9px] text-slate-400 font-mono">{depth}m</span>
              <div className="flex-1 border-t border-dashed border-slate-200 ml-1" />
            </div>
          );
        })}
      </div>
      <div className="flex-1 relative" style={{ height: totalHeight }}>
        {strataLogs.map((l, i) => {
          const from = l.depth_from || 0;
          const to = l.depth_to || from;
          const topPx = from * pxPerM;
          const heightPx = Math.max(2, (to - from) * pxPerM);
          const color = strataColors[l.strata_descriptor] || strataColors.other;
          const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
          return (
            <div
              key={l.id || i}
              className="absolute left-0 right-0 border-b border-white/40 flex items-center justify-center overflow-hidden group"
              style={{ top: topPx, height: heightPx, backgroundColor: color }}
              title={`${sc?.label || 'Strata'}: ${from}–${to}m\n${l.strata_description_detail || ''}`}
            >
              {heightPx > 18 && (
                <span className="text-[9px] font-bold text-white/90 truncate px-1 leading-tight">
                  {sc?.label && l.strata_descriptor !== 'other' ? sc.label : ''}
                </span>
              )}
            </div>
          );
        })}
        {groundwaterDepth != null && (
          <div className="absolute left-0 right-0 border-t-2 border-cyan-400 border-dashed" style={{ top: groundwaterDepth * pxPerM }}>
            <Droplets className="w-3 h-3 text-cyan-500 absolute -right-0.5 -top-1.5 bg-white rounded-full p-0.5" />
          </div>
        )}
      </div>
    </div>
  );
}