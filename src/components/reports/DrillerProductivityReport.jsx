import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, HardHat, Gauge, TrendingUp, PoundSterling, Layers,
  Download, FileText, Loader2, ChevronDown, ChevronRight,
  Activity, Clock, Target, Award, Users, Wrench,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from 'recharts';
import { buildDrillerProductivityReport, buildDrillerPdfSections, buildDrillerCsvData } from '@/utils/drillerProductivityReport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';

const PIE_COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b'];

function KpiTile({ icon: Icon, label, value, sub, gradient }) {
  return (
    <div className="insight-card rounded-2xl p-4 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full ${gradient} opacity-10 -mr-8 -mt-8`} />
      <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
      </div>
      <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-bold text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DrillerCard({ driller, isExpanded, onToggle }) {
  const utilisationColor = driller.utilisation >= 60 ? 'text-emerald-600' : driller.utilisation >= 40 ? 'text-amber-600' : 'text-rose-600';
  const marginColor = driller.margin >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const pieData = [
    { name: 'Drilling', value: driller.drillingMinutes },
    { name: 'Setup', value: driller.setupMinutes },
    { name: 'Travel', value: driller.travelMinutes },
    { name: 'Downtime', value: driller.downtimeMinutes },
  ].filter(d => d.value > 0);

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50/50 transition">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#4d7c2a] flex items-center justify-center flex-shrink-0 shadow-sm">
          <HardHat className="w-5.5 h-5.5 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 truncate">{driller.name}</p>
            <span className="text-[10px] font-bold text-slate-400">·</span>
            <p className="text-[11px] text-slate-500">{driller.jobCount} job{driller.jobCount !== 1 ? 's' : ''} · {driller.daysWorked} day{driller.daysWorked !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs font-bold text-primary">{driller.totalMeterage.toFixed(1)} m</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-semibold text-slate-600">{(driller.drillingMinutes / 60).toFixed(1)}h drilling</span>
            <span className="text-xs text-slate-400">·</span>
            <span className={`text-xs font-bold ${utilisationColor}`}>{driller.utilisation.toFixed(0)}% util</span>
            <span className="text-xs text-slate-400">·</span>
            <span className={`text-xs font-bold ${marginColor}`}>{driller.margin >= 0 ? '+' : ''}£{Math.round(driller.margin).toLocaleString('en-GB')}</span>
          </div>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/30">
          {/* Time breakdown donut + stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-2">Time Breakdown</p>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${(v / 60).toFixed(1)}h`} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400 py-8 text-center">No time data</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Output</p>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Boreholes" value={driller.boreholeCount} />
                <Stat label="Completed" value={driller.boreholesCompleted} />
                <Stat label="SPTs" value={driller.sptCount} />
                <Stat label="Samples" value={driller.sampleCount} />
                <Stat label="Core Runs" value={driller.coreCount} />
                <Stat label="Avg m/hr" value={driller.avgMetersPerHour.toFixed(1)} />
              </div>
            </div>
          </div>

          {/* Rigs + Jobs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">Rigs Operated</p>
              <div className="flex flex-wrap gap-1.5">
                {driller.rigs.length > 0 ? driller.rigs.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                    <Wrench className="w-3 h-3 text-primary" /> {r}
                  </span>
                )) : <span className="text-[10px] text-slate-400">No rig data</span>}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">Jobs</p>
              <div className="flex flex-wrap gap-1.5">
                {driller.jobs.map(j => (
                  <span key={j} className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 max-w-[180px] truncate">
                    {j}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400">Revenue</p>
              <p className="text-sm font-extrabold text-emerald-600">£{Math.round(driller.chargeableRevenue).toLocaleString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Labour Cost</p>
              <p className="text-sm font-extrabold text-slate-700">£{Math.round(driller.labourCost).toLocaleString('en-GB')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Margin</p>
              <p className={`text-sm font-extrabold ${marginColor}`}>£{Math.round(driller.margin).toLocaleString('en-GB')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-slate-100">
      <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function RigCrewMatrix({ rigCrewLinks }) {
  if (rigCrewLinks.length === 0) return null;

  // Build the matrix: rows = crew, columns = rigs
  const allCrew = new Set();
  rigCrewLinks.forEach(rc => rc.crew.forEach(c => allCrew.add(c)));
  const crewList = [...allCrew].sort();
  const rigList = rigCrewLinks.map(rc => rc.rig);

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
          <Wrench className="w-4 h-4 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Rig → Crew Linkage</h3>
          <p className="text-[10px] text-slate-400">{rigCrewLinks.length} rigs · {crewList.length} drillers</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-3 font-bold text-slate-500 sticky left-0 bg-white">Driller</th>
              {rigList.map(r => (
                <th key={r} className="text-center py-2 px-2 font-bold text-slate-500 whitespace-nowrap" title={r}>
                  {r.length > 12 ? r.slice(0, 10) + '…' : r}
                </th>
              ))}
              <th className="text-center py-2 px-2 font-bold text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {crewList.map(crew => {
              const rigsWorked = rigList.filter(r => {
                const rc = rigCrewLinks.find(x => x.rig === r);
                return rc && rc.crew.includes(crew);
              });
              return (
                <tr key={crew} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 pr-3 font-semibold text-slate-700 sticky left-0 bg-white">{crew}</td>
                  {rigList.map(r => {
                    const rc = rigCrewLinks.find(x => x.rig === r);
                    const linked = rc && rc.crew.includes(crew);
                    return (
                      <td key={r} className="text-center py-2 px-2">
                        {linked ? (
                          <span className="inline-block w-5 h-5 rounded-md bg-primary text-white text-[9px] font-bold flex items-center justify-center">✓</span>
                        ) : (
                          <span className="inline-block w-5 h-5 rounded-md bg-slate-100 text-slate-300 text-[9px]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-2 font-bold text-primary">{rigsWorked.length}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/50">
              <td className="py-2 pr-3 font-bold text-slate-600 sticky left-0 bg-slate-50">Boreholes</td>
              {rigList.map(r => {
                const rc = rigCrewLinks.find(x => x.rig === r);
                return <td key={r} className="text-center py-2 px-2 font-bold text-slate-700">{rc?.boreholeCount || 0}</td>;
              })}
              <td className="text-center py-2 px-2 font-bold text-slate-700">{rigCrewLinks.reduce((s, rc) => s + rc.boreholeCount, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function DrillerProductivityReport({ filters }) {
  const { toast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDriller, setExpandedDriller] = useState(null);
  const [exporting, setExporting] = useState(null);

  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    buildDrillerProductivityReport(filters)
      .then(r => { if (active) setReport(r); })
      .catch(() => { if (active) setReport(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(filters)]);

  const divisionName = divisions.find(d => d.id === filters.divisionId)?.name;

  const handlePdf = async () => {
    if (!report || report.drillers.length === 0) {
      toast({ title: 'No data', description: 'No driller activity in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const filterSummary = buildFilterSummary(filters, divisionName, null, null, filters.jobTypeId);
      const sections = buildDrillerPdfSections(report);
      await generateReportPdf({
        title: 'Driller Productivity Report',
        subtitle: 'Meterage · Time · Revenue · Rig-Crew Linkage',
        filterSummary,
        sections,
      });
      toast({ title: 'PDF exported', description: `${report.drillers.length} drillers included.` });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  const handleCsv = () => {
    if (!report || report.drillers.length === 0) {
      toast({ title: 'No data', description: 'No driller activity in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('csv');
    try {
      const sheets = buildDrillerCsvData(report);
      // Download each sheet as a separate CSV
      sheets.forEach(sheet => {
        downloadStructuredCsv(sheet.filename, sheet.columns, sheet.rows);
      });
      toast({ title: 'CSV exported', description: `${sheets.length} sheets downloaded.` });
    } catch (e) {
      toast({ title: 'CSV export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!report || report.drillers.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-12 text-center">
        <Drill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">No driller activity found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting the date range or filters.</p>
      </div>
    );
  }

  const { drillers, rigCrewLinks, dailyData, totals } = report;

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <button onClick={handlePdf} disabled={exporting === 'pdf'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-[#244715] active:scale-95 transition disabled:opacity-50">
          {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          PDF Report
        </button>
        <button onClick={handleCsv} disabled={exporting === 'csv'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:border-primary hover:text-primary active:scale-95 transition disabled:opacity-50">
          {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Excel/CSV
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile icon={HardHat} label="Drillers" value={totals.drillerCount} gradient="stat-gradient-brand" />
        <KpiTile icon={Drill} label="Total Meterage" value={`${totals.totalMeterage.toFixed(0)}m`} gradient="stat-gradient-emerald" />
        <KpiTile icon={Clock} label="Drill Hours" value={totals.totalDrillingHours.toFixed(1)} gradient="stat-gradient-blue" />
        <KpiTile icon={Gauge} label="Avg Utilisation" value={`${totals.avgUtilisation.toFixed(0)}%`} gradient="stat-gradient-amber" />
        <KpiTile icon={TrendingUp} label="Revenue" value={`£${Math.round(totals.totalRevenue).toLocaleString('en-GB')}`} gradient="stat-gradient-teal" />
        <KpiTile icon={PoundSterling} label="Net Margin" value={`£${Math.round(totals.totalMargin).toLocaleString('en-GB')}`} gradient={totals.totalMargin >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose'} />
      </div>

      {/* Daily meterage chart */}
      {dailyData.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Daily Drilling Activity</h3>
              <p className="text-[10px] text-slate-400">Meterage and drilling hours per day</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: 'm', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'hrs', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
              <Bar yAxisId="left" dataKey="meterage" fill="#2E5A1A" radius={[4, 4, 0, 0]} name="Meterage (m)" />
              <Line yAxisId="right" type="monotone" dataKey="drillingHours" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Drilling Hours" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-driller cards */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Driller Breakdown</h3>
            <p className="text-[10px] text-slate-400">{drillers.length} drillers · tap to expand</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {drillers.map((d, i) => (
            <DrillerCard
              key={d.name}
              driller={d}
              isExpanded={expandedDriller === i}
              onToggle={() => setExpandedDriller(expandedDriller === i ? null : i)}
            />
          ))}
        </div>
      </div>

      {/* Rig-Crew matrix */}
      <RigCrewMatrix rigCrewLinks={rigCrewLinks} />
    </div>
  );
}