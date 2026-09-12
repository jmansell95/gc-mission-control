import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Drill, Download, FileText, Loader2, TrendingUp, Gauge, Wrench } from 'lucide-react';
import { buildRigPerformanceReport, buildRigPdfSections, buildRigCsvData } from '@/utils/rigPerformanceReport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';

export default function RigPerformanceReport({ filters }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['report-filter-teams', filters.divisionId],
    queryFn: () => base44.entities.Team.filter(filters.divisionId ? { division_id: filters.divisionId } : {}, '-created_date', 200),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['report-filter-clients', filters.divisionId],
    queryFn: () => base44.entities.Client.filter(filters.divisionId ? { division_id: filters.divisionId } : {}, '-created_date', 200),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    buildRigPerformanceReport(filters)
      .then(r => { if (active) setReport(r); })
      .catch(() => { if (active) setReport(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(filters)]);

  const divisionName = divisions.find(d => d.id === filters.divisionId)?.name;
  const teamName = teams.find(t => t.id === filters.teamId)?.name;
  const clientName = clients.find(c => c.id === filters.clientId)?.name;
  const jobTypeName = filters.jobTypeId || '';

  const handlePdf = async () => {
    if (!report || report.rigData.length === 0) {
      toast({ title: 'No data', description: 'No rig activity in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const filterSummary = buildFilterSummary(filters, divisionName, teamName, clientName, jobTypeName);
      const sections = buildRigPdfSections(report);
      await generateReportPdf({
        title: 'Rig Performance Report',
        subtitle: 'Operational + Financial Breakdown',
        filterSummary,
        sections,
      });
      toast({ title: 'PDF exported', description: `${report.rigData.length} rigs included.` });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  const handleCsv = () => {
    if (!report || report.rigData.length === 0) {
      toast({ title: 'No data', description: 'No rig activity in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('csv');
    try {
      const { columns, rows } = buildRigCsvData(report);
      downloadStructuredCsv('rig-performance-report.csv', columns, rows);
      toast({ title: 'CSV exported', description: `${rows.length} rows.` });
    } catch (e) {
      toast({ title: 'CSV export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!report || report.rigData.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <Drill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">No rig activity in the selected range</p>
        <p className="text-xs text-slate-400 mt-1">Try widening the date range or clearing filters.</p>
      </div>
    );
  }

  const { rigData, totals } = report;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-primary flex items-center justify-center"><Drill className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Active Rigs</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{rigData.length}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Revenue</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">£{Math.round(totals.totalRevenue).toLocaleString('en-GB')}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center"><Gauge className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Utilization</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totals.avgUtilization.toFixed(1)}%</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><Wrench className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Meterage</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totals.totalMeterage.toFixed(1)}m</p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <button onClick={handleCsv} disabled={!!exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition disabled:opacity-50">
          {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
        </button>
        <button onClick={handlePdf} disabled={!!exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-[#244715] text-white text-sm font-semibold transition disabled:opacity-50 shadow-sm">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export PDF
        </button>
      </div>

      {/* Preview table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Per-Rig Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Rig</th>
                <th className="text-right px-3 py-2.5">Revenue</th>
                <th className="text-right px-3 py-2.5">Cost</th>
                <th className="text-right px-3 py-2.5">Profit</th>
                <th className="text-right px-3 py-2.5">Margin</th>
                <th className="text-right px-3 py-2.5">Util</th>
                <th className="text-right px-3 py-2.5">Meterage</th>
                <th className="text-left px-3 py-2.5">Crew</th>
              </tr>
            </thead>
            <tbody>
              {rigData.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">£{Math.round(r.totalRevenue).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">£{Math.round(r.totalCost).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-primary">£{Math.round(r.profit).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.marginPct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.utilizationPct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.totalMeterage.toFixed(1)}m</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs truncate max-w-[160px]">{r.crewNames}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#8DC63F]/20 border-t-2 border-[#8DC63F]">
                <td className="px-4 py-2.5 font-bold text-primary">TOTAL</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">£{Math.round(totals.totalRevenue).toLocaleString('en-GB')}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">£{Math.round(totals.totalCost).toLocaleString('en-GB')}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">£{Math.round(totals.profit).toLocaleString('en-GB')}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">{totals.marginPct.toFixed(1)}%</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">{totals.avgUtilization.toFixed(1)}%</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">{totals.totalMeterage.toFixed(1)}m</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}