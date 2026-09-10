import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase, PoundSterling, TrendingUp, CalendarClock, Users, Drill,
  Download, FileText, Loader2, ChevronRight, AlertCircle,
} from 'lucide-react';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { useToast } from '@/components/ui/use-toast';
import RemainingWorkDrillDown from './RemainingWorkDrillDown';
import PortfolioMonthlyChart from './PortfolioMonthlyChart';

const STATUS_CONFIG = {
  planning: { label: 'Planning', pill: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', pill: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  on_hold: { label: 'On Hold', pill: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  decommissioning: { label: 'Decommissioning', pill: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500' },
  completed: { label: 'Completed', pill: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-rose-100 text-rose-700 border-rose-300', dot: 'bg-rose-500' },
};

const ALL_STATUSES = ['planning', 'in_progress', 'on_hold', 'decommissioning', 'completed'];
const DEFAULT_STATUSES = ['planning', 'in_progress', 'on_hold', 'decommissioning'];

const fmtMoney = (n) => '£' + Math.round(Number(n) || 0).toLocaleString('en-GB');
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function RemainingWorkReport({ filters }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUSES);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [ignoreDateRange, setIgnoreDateRange] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [drillJob, setDrillJob] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['report-filter-clients', filters.divisionId],
    queryFn: () => base44.entities.Client.filter(filters.divisionId ? { division_id: filters.divisionId } : {}, '-created_date', 200),
  });

  const toggleStatus = (s) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const payload = {
        as_of_date: asOfDate,
        status_filter: statusFilter,
        division_id: filters.divisionId || '',
        client_id: filters.clientId || '',
        job_type_id: filters.jobTypeId || '',
        date_from: ignoreDateRange ? '' : (filters.dateFrom || ''),
        date_to: ignoreDateRange ? '' : (filters.dateTo || ''),
      };
      const res = await base44.functions.invoke('getRemainingWorkProjection', payload);
      setData(res.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate, statusFilter, filters.divisionId, filters.clientId, filters.jobTypeId, filters.dateFrom, filters.dateTo, ignoreDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const divisionName = divisions.find(d => d.id === filters.divisionId)?.name;
  const clientName = clients.find(c => c.id === filters.clientId)?.name;

  const handleCsv = () => {
    if (!data || data.jobs.length === 0) { toast({ title: 'No data', variant: 'destructive' }); return; }
    setExporting('csv');
    try {
      // Build per-job rows with monthly columns appended
      const monthKeys = (data.portfolio_monthly || []).map(m => m.month_key);
      const monthLabels = (data.portfolio_monthly || []).map(m => m.month);
      const columns = [
        { key: 'job_name', label: 'Job' },
        { key: 'status', label: 'Status' },
        { key: 'start_date', label: 'Start' },
        { key: 'end_date', label: 'End' },
        { key: 'remaining_working_days', label: 'Days Remaining' },
        { key: 'people_assigned_count', label: 'People' },
        { key: 'rigs_on_site_count', label: 'Rigs' },
        { key: 'contracted_total', label: 'Contracted (£)' },
        { key: 'earned_to_date', label: 'Earned to Date (£)' },
        { key: 'remaining_balance', label: 'Remaining Balance (£)' },
        { key: 'daily_run_rate', label: 'Daily Run-Rate (£)' },
        { key: 'projected_earnings', label: 'Projected Earnings (£)' },
        { key: 'variance', label: 'Variance (£)' },
        ...monthLabels.map((ml, i) => ({ key: `month_${monthKeys[i]}`, label: `${ml} (£)` })),
      ];
      const rows = data.jobs.map(j => {
        const row = {
          ...j,
          status: STATUS_CONFIG[j.status]?.label || j.status,
          crew_names: undefined,
          rig_names: undefined,
          monthly_projection: undefined,
        };
        // Add per-month projected income columns
        for (const mk of monthKeys) {
          const m = (j.monthly_projection || []).find(mp => mp.month_key === mk);
          row[`month_${mk}`] = m ? m.projected : 0;
        }
        return row;
      });
      downloadStructuredCsv('remaining-work-report.csv', columns, rows);
      toast({ title: 'CSV exported', description: `${rows.length} jobs with ${monthKeys.length} monthly columns.` });
    } catch (e) { toast({ title: 'CSV export failed', variant: 'destructive' }); }
    setExporting(null);
  };

  const handlePdf = async () => {
    if (!data || data.jobs.length === 0) { toast({ title: 'No data', variant: 'destructive' }); return; }
    setExporting('pdf');
    try {
      const filterSummary = buildFilterSummary(
        { ...filters, dateFrom: ignoreDateRange ? '' : filters.dateFrom, dateTo: ignoreDateRange ? '' : filters.dateTo },
        divisionName, null, clientName, filters.jobTypeId
      );
      const columns = [
        { label: 'Job', align: 'left', width: 2.5 },
        { label: 'Status', align: 'left', width: 1 },
        { label: 'Days Left', align: 'right', width: 0.8 },
        { label: 'People', align: 'right', width: 0.7 },
        { label: 'Rigs', align: 'right', width: 0.6 },
        { label: 'Contracted', align: 'right', width: 1.2 },
        { label: 'Earned', align: 'right', width: 1.2 },
        { label: 'Remaining', align: 'right', width: 1.2 },
        { label: 'Projected', align: 'right', width: 1.2 },
      ];
      const rows = data.jobs.map(j => [
        j.job_name || '—',
        STATUS_CONFIG[j.status]?.label || j.status,
        j.remaining_working_days,
        j.people_assigned_count,
        j.rigs_on_site_count,
        fmtMoney(j.contracted_total),
        fmtMoney(j.earned_to_date),
        fmtMoney(j.remaining_balance),
        fmtMoney(j.projected_earnings),
      ]);
      const totals = ['Total', '', '', data.totals.total_people, data.totals.total_rigs,
        fmtMoney(data.totals.total_contracted), fmtMoney(data.totals.total_earned),
        fmtMoney(data.totals.total_remaining), fmtMoney(data.totals.total_projected)];

      await generateReportPdf({
        title: 'Remaining Work Value Report',
        subtitle: `Projected from ${fmtDate(asOfDate)}`,
        filterSummary,
        sections: [
          { title: 'Per-Job Projection', columns, rows, totals },
          ...(data.portfolio_monthly && data.portfolio_monthly.length > 0 ? [{
            title: 'Monthly Income Projection (Portfolio)',
            columns: [
              { label: 'Month', align: 'left', width: 1.5 },
              { label: 'Work Days', align: 'right', width: 1 },
              { label: 'Crew', align: 'right', width: 0.8 },
              { label: 'Rigs', align: 'right', width: 0.8 },
              { label: 'Projected', align: 'right', width: 1.5 },
            ],
            rows: data.portfolio_monthly.map(m => [
              m.month, m.working_days, m.crew_count, m.rig_count, fmtMoney(m.projected),
            ]),
            totals: [
              'Total',
              data.portfolio_monthly.reduce((s, m) => s + m.working_days, 0),
              '', '',
              fmtMoney(data.portfolio_monthly.reduce((s, m) => s + m.projected, 0)),
            ],
          }] : []),
        ],
      });
      toast({ title: 'PDF exported', description: `${data.jobs.length} jobs.` });
    } catch (e) { toast({ title: 'PDF export failed', variant: 'destructive' }); }
    setExporting(null);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="space-y-4">
        <RemainingWorkFilterBar
          statusFilter={statusFilter} toggleStatus={toggleStatus}
          asOfDate={asOfDate} setAsOfDate={setAsOfDate}
          ignoreDateRange={ignoreDateRange} setIgnoreDateRange={setIgnoreDateRange}
          onExportCsv={handleCsv} onExportPdf={handlePdf} exporting={exporting}
        />
        <div className="insight-card rounded-2xl p-8 text-center">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">No jobs match the selected filters</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting the status filters or date range.</p>
        </div>
      </div>
    );
  }

  const { jobs, totals } = data;

  return (
    <div className="space-y-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={PoundSterling} label="Total Contracted" value={fmtMoney(totals.total_contracted)} gradient="stat-gradient-brand" />
        <StatTile icon={TrendingUp} label="Earned to Date" value={fmtMoney(totals.total_earned)} gradient="stat-gradient-emerald" />
        <StatTile icon={CalendarClock} label="Remaining Balance" value={fmtMoney(totals.total_remaining)} gradient="stat-gradient-amber" />
        <StatTile icon={TrendingUp} label="Projected Earnings" value={fmtMoney(totals.total_projected)} gradient="stat-gradient-blue" />
      </div>

      {/* Filter bar */}
      <RemainingWorkFilterBar
        statusFilter={statusFilter} toggleStatus={toggleStatus}
        asOfDate={asOfDate} setAsOfDate={setAsOfDate}
        ignoreDateRange={ignoreDateRange} setIgnoreDateRange={setIgnoreDateRange}
        onExportCsv={handleCsv} onExportPdf={handlePdf} exporting={exporting}
      />

      {/* Portfolio monthly chart */}
      {data.portfolio_monthly && <PortfolioMonthlyChart portfolioMonthly={data.portfolio_monthly} />}

      {/* Job table */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Remaining Work by Job</h3>
          <span className="text-xs text-slate-400">{jobs.length} jobs · as of {fmtDate(asOfDate)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Job</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Days Left</th>
                <th className="text-center px-3 py-2.5">People</th>
                <th className="text-center px-3 py-2.5">Rigs</th>
                <th className="text-right px-3 py-2.5">Contracted</th>
                <th className="text-right px-3 py-2.5">Earned</th>
                <th className="text-right px-3 py-2.5">Remaining</th>
                <th className="text-right px-3 py-2.5">Run Rate/Day</th>
                <th className="text-right px-3 py-2.5">Projected</th>
                <th className="text-right px-3 py-2.5">Variance</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const sc = STATUS_CONFIG[j.status] || {};
                const positiveVariance = j.variance >= 0;
                return (
                  <tr key={j.job_id}
                    onClick={() => setDrillJob(j)}
                    className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer transition">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900 truncate max-w-[200px]">{j.job_name}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(j.start_date)} → {fmtDate(j.end_date)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.pill || ''}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot || 'bg-slate-400'}`} />
                        {sc.label || j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700">{j.remaining_working_days}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{j.people_assigned_count > 0 ? <Users className="w-3.5 h-3.5 text-slate-500 inline" /> : '—'} {j.people_assigned_count > 0 ? j.people_assigned_count : ''}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{j.rigs_on_site_count > 0 ? <Drill className="w-3.5 h-3.5 text-slate-500 inline" /> : '—'} {j.rigs_on_site_count > 0 ? j.rigs_on_site_count : ''}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(j.contracted_total)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(j.earned_to_date)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{fmtMoney(j.remaining_balance)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtMoney(j.daily_run_rate)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2E5A1A]">{fmtMoney(j.projected_earnings)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${positiveVariance ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {positiveVariance ? '+' : ''}{fmtMoney(j.variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#8DC63F]/20 border-t-2 border-[#8DC63F]">
                <td className="px-4 py-2.5 font-bold text-[#2E5A1A]">TOTAL</td>
                <td></td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{jobs.reduce((s, j) => s + j.remaining_working_days, 0)}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#2E5A1A]">{totals.total_people}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#2E5A1A]">{totals.total_rigs}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmtMoney(totals.total_contracted)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmtMoney(totals.total_earned)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmtMoney(totals.total_remaining)}</td>
                <td></td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmtMoney(totals.total_projected)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">
                  {totals.total_projected >= totals.total_remaining ? '+' : ''}
                  {fmtMoney(totals.total_projected - totals.total_remaining)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
          <ChevronRight className="w-3 h-3" />
          Click any job row for the monthly projection breakdown and resource detail.
        </div>
      </div>

      {drillJob && (
        <RemainingWorkDrillDown job={drillJob} asOfDate={asOfDate} onClose={() => setDrillJob(null)} />
      )}
    </div>
  );
}

// ── Filter bar sub-component ──
function RemainingWorkFilterBar({ statusFilter, toggleStatus, asOfDate, setAsOfDate, ignoreDateRange, setIgnoreDateRange, onExportCsv, onExportPdf, exporting }) {
  return (
    <div className="insight-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Status</span>
          {ALL_STATUSES.map(s => {
            const sc = STATUS_CONFIG[s];
            const active = statusFilter.includes(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold border transition ${active ? sc.pill : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* As-of date */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">As of</label>
          <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-900 focus:border-[#2E5A1A] outline-none" />
        </div>

        {/* Ignore date range toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={ignoreDateRange} onChange={e => setIgnoreDateRange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
          <span className="text-xs font-medium text-slate-600">Ignore date range (show all active jobs)</span>
        </label>

        {/* Export buttons */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button onClick={onExportCsv} disabled={!!exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition disabled:opacity-50">
            {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} CSV
          </button>
          <button onClick={onExportPdf} disabled={!!exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] hover:bg-[#244715] text-white text-xs font-semibold transition disabled:opacity-50 shadow-sm">
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </button>
        </div>
      </div>

      {!ignoreDateRange && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <AlertCircle className="w-3 h-3" />
          Date range filter is active — only jobs active within the selected range are shown.
        </div>
      )}
    </div>
  );
}

// ── Stat tile sub-component ──
function StatTile({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`${gradient} rounded-2xl p-4 text-white relative overflow-hidden`}>
      <div className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
        {Icon && <Icon className="w-12 h-12" />}
      </div>
      <div className="relative">
        <div className="flex items-start justify-between mb-1">
          {Icon && <Icon className="w-4 h-4 opacity-80" />}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 leading-tight">{label}</p>
        <p className="text-xl font-extrabold mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}