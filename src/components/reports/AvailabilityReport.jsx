import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Grid3x3, Download, FileText, Loader2, Users, Cog } from 'lucide-react';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';
import { STATUS_CONFIG, buildStatusMaps } from '@/components/rota/heatmapUtils';
import { format, addDays } from 'date-fns';

export default function AvailabilityReport({ filters }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(null);

  // Determine year from dateFrom (or current year)
  const year = useMemo(() => {
    if (filters.dateFrom) return new Date(filters.dateFrom + 'T00:00:00').getFullYear();
    return new Date().getFullYear();
  }, [filters.dateFrom]);

  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['availability-matrix', year, filters.divisionId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailabilityMatrix', { year, division_id: filters.divisionId || '' });
      return res.data;
    },
  });

  // Build days for the date range
  const days = useMemo(() => {
    const from = filters.dateFrom || `${year}-01-01`;
    const to = filters.dateTo || `${year}-12-31`;
    const ds = [];
    let d = new Date(from + 'T00:00:00');
    const e = new Date(to + 'T00:00:00');
    while (d <= e) {
      ds.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return ds;
  }, [filters.dateFrom, filters.dateTo, year]);

  const { staffStatus, rigStatus } = useMemo(() => buildStatusMaps(data), [data]);

  // Compute per-resource summaries for the date range
  const resourceSummaries = useMemo(() => {
    if (!data) return [];
    const results = [];

    (data.staff || []).forEach(s => {
      const sm = staffStatus.get(s.id) || new Map();
      const counts = { job: 0, annual_leave: 0, sick: 0, training: 0, yard_depot: 0, maintenance: 0, available: 0 };
      days.forEach(ds => {
        const st = sm.get(ds);
        if (st) counts[st.type] = (counts[st.type] || 0) + 1;
        else counts.available++;
      });
      const workingDays = counts.job + counts.yard_depot;
      const offDays = counts.annual_leave + counts.sick + counts.training;
      const utilDenom = workingDays + counts.available;
      const utilization = utilDenom > 0 ? Math.round((workingDays / utilDenom) * 100) : 0;
      results.push({
        name: s.name, type: 'Staff', team: s.team_name || s.job_title || '',
        daysOnJob: counts.job, daysAvailable: counts.available, daysOff: offDays, daysDepot: counts.yard_depot,
        utilization, statusMap: sm,
      });
    });

    (data.rigs || []).forEach(r => {
      const rm = rigStatus.get(r.id) || new Map();
      const counts = { job: 0, maintenance: 0, available: 0 };
      days.forEach(ds => {
        const st = rm.get(ds);
        if (st) counts[st.type] = (counts[st.type] || 0) + 1;
        else counts.available++;
      });
      const utilDenom = counts.job + counts.available;
      const utilization = utilDenom > 0 ? Math.round((counts.job / utilDenom) * 100) : 0;
      results.push({
        name: r.name, type: 'Rig', team: [r.make, r.model].filter(Boolean).join(' ') || r.rig_type || '',
        daysOnJob: counts.job, daysAvailable: counts.available, daysOff: 0, daysDepot: 0, daysMaintenance: counts.maintenance,
        utilization, statusMap: rm,
      });
    });

    return results;
  }, [data, days, staffStatus, rigStatus]);

  const divisionName = divisions.find(d => d.id === filters.divisionId)?.name;

  const handleCsv = () => {
    if (resourceSummaries.length === 0) {
      toast({ title: 'No data', description: 'No resources in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('csv');
    try {
      const columns = [
        { key: 'resource', label: 'Resource' },
        { key: 'type', label: 'Type' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'job_name', label: 'Job Name' },
        { key: 'job_reference', label: 'Job Reference' },
      ];
      const rows = [];
      resourceSummaries.forEach(r => {
        days.forEach(ds => {
          const st = r.statusMap.get(ds);
          const cfg = STATUS_CONFIG[st?.type] || STATUS_CONFIG.available;
          rows.push({
            resource: r.name, type: r.type, date: ds,
            status: cfg.label, job_name: st?.job_name || '', job_reference: st?.job_reference || '',
          });
        });
      });
      downloadStructuredCsv('availability-report.csv', columns, rows);
      toast({ title: 'CSV exported', description: `${rows.length} rows.` });
    } catch (e) {
      toast({ title: 'CSV export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  const handlePdf = () => {
    if (resourceSummaries.length === 0) {
      toast({ title: 'No data', description: 'No resources in the selected range.', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const filterSummary = buildFilterSummary(filters, divisionName, '', '', '');
      const columns = [
        { label: 'Resource', align: 'left', width: 2.5 },
        { label: 'Type', align: 'left', width: 1 },
        { label: 'Team/Model', align: 'left', width: 1.5 },
        { label: 'On Job', align: 'right', width: 1 },
        { label: 'Available', align: 'right', width: 1 },
        { label: 'Off', align: 'right', width: 1 },
        { label: 'Util %', align: 'right', width: 1 },
      ];
      const rows = resourceSummaries.map(r => [
        r.name, r.type, r.team,
        String(r.daysOnJob), String(r.daysAvailable), String(r.daysOff),
        `${r.utilization}%`,
      ]);
      const totals = [
        'Total', '', '',
        String(resourceSummaries.reduce((s, r) => s + r.daysOnJob, 0)),
        String(resourceSummaries.reduce((s, r) => s + r.daysAvailable, 0)),
        String(resourceSummaries.reduce((s, r) => s + r.daysOff, 0)),
        `${Math.round(resourceSummaries.reduce((s, r) => s + r.utilization, 0) / (resourceSummaries.length || 1))}%`,
      ];

      generateReportPdf({
        title: 'Availability Report',
        subtitle: 'Resource Utilization Summary',
        filterSummary,
        sections: [{ title: 'Resource Utilization', columns, rows, totals }],
      }).then(() => {
        toast({ title: 'PDF exported', description: `${resourceSummaries.length} resources.` });
      }).catch(() => {
        toast({ title: 'PDF export failed', variant: 'destructive' });
      });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-3 text-sm text-slate-500">Loading availability data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center">
            <Grid3x3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Availability Report</h3>
            <p className="text-xs text-slate-500">{resourceSummaries.length} resources · {days.length} days · {format(new Date(days[0] + 'T00:00:00'), 'd MMM')} – {format(new Date(days[days.length - 1] + 'T00:00:00'), 'd MMM yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCsv} disabled={exporting} className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:border-primary hover:text-primary transition disabled:opacity-50">
            {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
          </button>
          <button onClick={handlePdf} disabled={exporting} className="inline-flex items-center gap-1.5 h-9 px-3 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50">
            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
          </button>
        </div>
      </div>

      {/* Preview table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-bold text-slate-600">Resource</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-600">Type</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-600">Team / Model</th>
                <th className="text-right px-3 py-2.5 font-bold text-slate-600">On Job</th>
                <th className="text-right px-3 py-2.5 font-bold text-slate-600">Available</th>
                <th className="text-right px-3 py-2.5 font-bold text-slate-600">Off</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-600 w-40">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {resourceSummaries.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                  <td className="px-3 py-2 font-semibold text-slate-800 flex items-center gap-1.5">
                    {r.type === 'Rig' ? <Cog className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> : <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.type}</td>
                  <td className="px-3 py-2 text-slate-500 truncate max-w-[150px]">{r.team}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600 tabular-nums">{r.daysOnJob}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-400 tabular-nums">{r.daysAvailable}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-500 tabular-nums">{r.daysOff}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.utilization}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 tabular-nums w-8 text-right">{r.utilization}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}