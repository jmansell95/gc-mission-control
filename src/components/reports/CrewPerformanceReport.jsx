import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HardHat, Download, FileText, Loader2, Clock, TrendingUp, Users } from 'lucide-react';
import { buildCrewPerformanceReport, buildCrewPdfSection, buildCrewCsvData } from '@/utils/crewPerformanceReport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';

export default function CrewPerformanceReport({ filters }) {
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
    buildCrewPerformanceReport(filters)
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
    if (!report || report.crewData.length === 0) {
      toast({ title: 'No data', description: 'No crew timesheets in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const filterSummary = buildFilterSummary(filters, divisionName, teamName, clientName, jobTypeName);
      const section = buildCrewPdfSection(report);
      await generateReportPdf({
        title: 'Crew Performance Report',
        subtitle: 'Hours & Earnings per Staff Member',
        filterSummary,
        sections: [section],
      });
      toast({ title: 'PDF exported', description: `${report.crewData.length} staff members.` });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  const handleCsv = () => {
    if (!report || report.crewData.length === 0) {
      toast({ title: 'No data', description: 'No crew timesheets in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('csv');
    try {
      const { columns, rows } = buildCrewCsvData(report);
      downloadStructuredCsv('crew-performance-report.csv', columns, rows);
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

  if (!report || report.crewData.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">No crew timesheets in the selected range</p>
        <p className="text-xs text-slate-400 mt-1">Try widening the date range or clearing filters.</p>
      </div>
    );
  }

  const { crewData, totals } = report;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2E5A1A] flex items-center justify-center"><Users className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Crew Members</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{crewData.length}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Clock className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Hours</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totals.totalHours.toFixed(1)}h</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center"><Clock className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Overtime Hours</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totals.overtimeHours.toFixed(1)}h</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Revenue Earned</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">£{Math.round(totals.revenue).toLocaleString('en-GB')}</p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <button onClick={handleCsv} disabled={!!exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition disabled:opacity-50">
          {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
        </button>
        <button onClick={handlePdf} disabled={!!exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E5A1A] hover:bg-[#244715] text-white text-sm font-semibold transition disabled:opacity-50 shadow-sm">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export PDF
        </button>
      </div>

      {/* Preview table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Per-Staff Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Staff</th>
                <th className="text-left px-3 py-2.5">Title</th>
                <th className="text-left px-3 py-2.5">Team</th>
                <th className="text-right px-3 py-2.5">Hours</th>
                <th className="text-right px-3 py-2.5">OT</th>
                <th className="text-right px-3 py-2.5">Jobs</th>
                <th className="text-right px-3 py-2.5">Meterage</th>
                <th className="text-right px-3 py-2.5">Revenue</th>
                <th className="text-right px-3 py-2.5">Util</th>
              </tr>
            </thead>
            <tbody>
              {crewData.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.jobTitle}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.team}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.totalHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{r.overtimeHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.jobsWorked}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.meterage.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2E5A1A]">£{Math.round(r.revenue).toLocaleString('en-GB')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.utilizationPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#8DC63F]/20 border-t-2 border-[#8DC63F]">
                <td className="px-4 py-2.5 font-bold text-[#2E5A1A]">TOTAL</td>
                <td></td><td></td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{totals.totalHours.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{totals.overtimeHours.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{totals.jobsWorked}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{totals.meterage.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">£{Math.round(totals.revenue).toLocaleString('en-GB')}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{totals.avgUtilization.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}