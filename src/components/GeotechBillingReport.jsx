import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  Mountain, ArrowDownToLine, TestTube, Calculator, Boxes, Droplets,
  Package, Download, ChevronDown, ChevronRight, AlertCircle, PoundSterling,
  Layers, Gauge, Loader2, Search,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { Skeleton } from '@/components/StateViews';
import {
  aggregateGeotech, calculateGeotechCost, getSorDepthBands, getTotalMetres,
} from '@/utils/geotechBilling';
const fmt = (n) => (n != null ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
const mfmt = (n) => (n != null ? Number(n).toFixed(1) + 'm' : '—');

const DEPTH_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#ec4899', '#84cc16'];

export default function GeotechBillingReport({ onSelectJob }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['geotech-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['geotech-clients'], queryFn: () => base44.entities.Client.list() });
  const { data: invLogs = [] } = useQuery({ queryKey: ['geotech-inv-logs'], queryFn: () => base44.entities.InvestigationLog.filter({ source: 'ags_import' }) });
  const { data: sorItems = [] } = useQuery({ queryKey: ['geotech-sor'], queryFn: () => base44.entities.InvestigationSOR.list('-created_date', 500) });
  const { data: sampleRates = [] } = useQuery({
    queryKey: ['geotech-sample-rates'],
    queryFn: async () => {
      const all = await base44.entities.RateCardItem.filter({ category: 'materials' });
      return all.filter((r) => /sample/i.test(r.description || ''));
    },
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const sorDepthBands = useMemo(() => getSorDepthBands(sorItems), [sorItems]);

  // Build per-job geotech rows
  const rows = useMemo(() => {
    const byJob = {};
    invLogs.forEach((l) => {
      if (!l.job_id) return;
      if (!byJob[l.job_id]) byJob[l.job_id] = [];
      byJob[l.job_id].push(l);
    });
    return jobs
      .map((job) => {
        const logs = byJob[job.id] || [];
        const geotech = aggregateGeotech(logs);
        if (!geotech) return null;
        const cost = calculateGeotechCost(job, geotech, sorDepthBands, sampleRates);
        const client = clientById[job.client_id];
        return { job, geotech, cost, client };
      })
      .filter(Boolean)
      .sort((a, b) => (b.cost?.total || 0) - (a.cost?.total || 0));
  }, [jobs, invLogs, sorDepthBands, sampleRates, clientById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.job.name?.toLowerCase().includes(q) ||
      r.job.job_reference?.toLowerCase().includes(q) ||
      r.client?.name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Portfolio totals
  const totals = useMemo(() => ({
    jobs: filtered.length,
    boreholes: filtered.reduce((s, r) => s + r.geotech.boreholes.length, 0),
    metres: filtered.reduce((s, r) => s + r.geotech.totalMetres, 0),
    samples: filtered.reduce((s, r) => s + r.geotech.samples.total, 0),
    spt: filtered.reduce((s, r) => s + r.geotech.sptCount, 0),
    core: filtered.reduce((s, r) => s + r.geotech.coreRuns, 0),
    revenue: filtered.reduce((s, r) => s + (r.cost?.total || 0), 0),
  }), [filtered]);

  const exportCsv = () => {
    const lines = [];
    lines.push('Job Reference,Job Name,Client,Boreholes,Total Metres,SPT Tests,Core Runs,Samples (U),Samples (D),Samples (W),Meterage Rate,Meterage Revenue,SOR Band Total,Sample Total,Geotech Total,POA Flags');
    filtered.forEach((r) => {
      const c = r.cost;
      const g = r.geotech;
      lines.push([
        r.job.job_reference || '', r.job.name || '', r.client?.name || '',
        g.boreholes.length, g.totalMetres, g.sptCount, g.coreRuns,
        g.samples.undisturbed, g.samples.disturbed, g.samples.water,
        c?.meterageRate || 0, c?.meterageRevenue || 0, c?.sorBandTotal || 0, c?.sampleTotal || 0, c?.total || 0,
        [c?.hasPoaBands ? 'Depth bands' : '', c?.hasPoaSamples ? 'Samples' : ''].filter(Boolean).join('; ') || 'None',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geotech-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Mountain}
        title="Geotechnical Billing Report"
        description="KeyLogBook borehole data per job — metres drilled by depth band, samples, SPT & core runs with automatic costings"
        actions={
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50 shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      {/* Portfolio stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        {isLoading ? (
          [...Array(7)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <PortfolioStat icon={Mountain} value={totals.boreholes} label="Boreholes" gradient="stat-gradient-emerald" />
            <PortfolioStat icon={ArrowDownToLine} value={mfmt(totals.metres)} label="Total Metres" gradient="stat-gradient-blue" />
            <PortfolioStat icon={TestTube} value={totals.samples} label="Samples" gradient="stat-gradient-violet" />
            <PortfolioStat icon={Calculator} value={totals.spt} label="SPT Tests" gradient="stat-gradient-amber" />
            <PortfolioStat icon={Boxes} value={totals.core} label="Core Runs" gradient="stat-gradient-fuchsia" />
            <PortfolioStat icon={PoundSterling} value={fmt(totals.revenue)} label="Geotech Revenue" gradient="stat-gradient-teal" />
            <PortfolioStat icon={Layers} value={totals.jobs} label="Jobs" gradient="stat-gradient-slate" />
          </>
        )}
      </div>

      {/* Search */}
      <div className="hub-glass rounded-2xl p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job, reference or client…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="hub-glass rounded-2xl text-center py-16 text-slate-400 text-sm">
            <Mountain className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            No jobs with KeyLogBook borehole data yet.
            <p className="text-xs mt-1">Import an AGS file via Settings → AGS Import to populate this report.</p>
          </div>
        ) : (
          filtered.map((r) => (
            <GeotechJobCard
              key={r.job.id}
              row={r}
              expanded={expanded === r.job.id}
              onToggle={() => setExpanded(expanded === r.job.id ? null : r.job.id)}
              onSelectJob={onSelectJob}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PortfolioStat({ icon: Icon, value, label, gradient }) {
  return (
    <div className={`${gradient} rounded-xl p-3 text-white shadow-sm`}>
      <Icon className="w-4 h-4 opacity-80 mb-1" />
      <p className="text-lg font-extrabold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide opacity-90 font-semibold">{label}</p>
    </div>
  );
}

function GeotechJobCard({ row, expanded, onToggle, onSelectJob }) {
  const { job, geotech: g, cost: c, client } = row;
  const chartData = g.depthBands.map((b) => ({ name: `${b.from}-${b.to}m`, metres: b.metres }));

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Header row */}
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-emerald-50/30 transition">
        {expanded ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Mountain className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{job.name}</p>
          <p className="text-xs text-slate-400">
            {job.job_reference && <span className="font-mono">{job.job_reference} · </span>}
            {client?.name || 'No client'}
          </p>
        </div>
        {/* Mini stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <MiniStat icon={Mountain} value={g.boreholes.length} label="BH" color="text-emerald-700" />
          <MiniStat icon={ArrowDownToLine} value={mfmt(g.totalMetres)} label="depth" color="text-blue-700" />
          <MiniStat icon={TestTube} value={g.samples.total} label="smp" color="text-violet-700" />
          <MiniStat icon={Calculator} value={g.sptCount} label="SPT" color="text-amber-700" />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Geotech Total</p>
          <p className="text-base font-bold text-emerald-700 tabular-nums">{fmt(c?.total)}</p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-5 bg-slate-50/40">
          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <DetailStat icon={Mountain} value={g.boreholes.length} label="Boreholes" color="bg-emerald-50 text-emerald-700" />
            <DetailStat icon={ArrowDownToLine} value={mfmt(g.totalMetres)} label="Total Metres" color="bg-blue-50 text-blue-700" />
            <DetailStat icon={TestTube} value={g.samples.total} label="Samples" color="bg-violet-50 text-violet-700" />
            <DetailStat icon={Calculator} value={g.sptCount} label="SPT Tests" color="bg-amber-50 text-amber-700" />
            <DetailStat icon={Boxes} value={g.coreRuns} label="Core Runs" color="bg-fuchsia-50 text-fuchsia-700" />
            <DetailStat icon={Package} value={g.installations} label="Installations" color="bg-teal-50 text-teal-700" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Depth distribution chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" /> Depth Distribution
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">Metres drilled per depth band across all boreholes</p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" unit="m" />
                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v}m`, 'Metres']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="metres" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={DEPTH_COLORS[i % DEPTH_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No depth data</p>
              )}
            </div>

            {/* Cost summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <PoundSterling className="w-4 h-4 text-emerald-600" /> Cost Breakdown
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                {c?.usingMeterageRate
                  ? `Meterage rate £${c.meterageRate}/m × ${g.totalMetres}m`
                  : 'Priced SOR depth bands (meterage rate not set on job)'}
              </p>
              <div className="space-y-1.5 text-sm">
                {c?.usingMeterageRate && (
                  <CostLine label={`Borehole meterage (${g.totalMetres}m × £${c.meterageRate}/m)`} value={c.meterageRevenue} />
                )}
                {!c?.usingMeterageRate && (
                  <CostLine label="Priced SOR depth bands" value={c?.sorBandTotal} />
                )}
                {c?.sampleTotal > 0 && <CostLine label="Sample charges" value={c.sampleTotal} />}
                <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Geotech Total</span>
                  <span className="font-bold text-emerald-700 text-base tabular-nums">{fmt(c?.total)}</span>
                </div>
              </div>
              {(c?.hasPoaBands || c?.hasPoaSamples) && (
                <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    Some {c.hasPoaBands && 'depth-band rates are '} {c.hasPoaBands && c.hasPoaSamples && 'and '}{c.hasPoaSamples && 'sample rates are '}marked POA in the SOR — pricing required before invoicing.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sample + borehole detail tables */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Samples */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                <TestTube className="w-4 h-4 text-violet-600" /> Samples
              </h4>
              <div className="space-y-1">
                {c?.samplePricing.map((p) => (
                  <div key={p.type} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                    <div>
                      <span className="font-medium text-slate-700 capitalize">{p.type}</span>
                      <span className="text-slate-400 ml-2">×{p.count}</span>
                      {p.rateDescription && <span className="text-[10px] text-slate-400 block">{p.rateDescription}</span>}
                    </div>
                    <div className="text-right">
                      {p.isPriced ? (
                        <span className="font-semibold text-slate-800 tabular-nums">{fmt(p.lineCost)}</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">POA</span>
                      )}
                    </div>
                  </div>
                ))}
                {g.samples.total === 0 && <p className="text-xs text-slate-400 py-2">No samples recorded.</p>}
              </div>
            </div>

            {/* Borehole list */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                <Mountain className="w-4 h-4 text-emerald-600" /> Boreholes
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {g.boreholes.map((b) => (
                  <div key={b.ref} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                    <span className="font-mono font-medium text-slate-700">{b.ref}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-0.5"><ArrowDownToLine className="w-3 h-3" />{mfmt(b.maxDepth)}</span>
                      {b.groundwater != null && <span className="inline-flex items-center gap-0.5 text-cyan-600"><Droplets className="w-3 h-3" />{mfmt(b.groundwater)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {onSelectJob && (
            <button onClick={() => onSelectJob(job)}
              className="text-xs text-emerald-700 font-semibold hover:text-emerald-800 flex items-center gap-1">
              Open job details →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center">
      <Icon className={`w-3.5 h-3.5 mx-auto ${color}`} />
      <p className={`font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 uppercase">{label}</p>
    </div>
  );
}

function DetailStat({ icon: Icon, value, label, color }) {
  return (
    <div className={`${color} rounded-xl p-3 flex items-center gap-2.5`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="text-lg font-extrabold tabular-nums leading-tight">{value}</p>
        <p className="text-[10px] uppercase tracking-wide font-semibold opacity-80">{label}</p>
      </div>
    </div>
  );
}

function CostLine({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{fmt(value)}</span>
    </div>
  );
}