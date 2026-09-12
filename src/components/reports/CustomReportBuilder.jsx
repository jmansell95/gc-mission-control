import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileBarChart, Plus, Trash2, Download, Loader2, Settings2, FileText, Bookmark, Clock, BarChart3, LineChart, PieChart } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchableSelect from '@/components/SearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { format, parseISO, subDays } from 'date-fns';
import ReportChart from './ReportChart';
import ReportSaveModal from './ReportSaveModal';
import ReportScheduleModal from './ReportScheduleModal';

/**
 * Custom Report Builder — drag-and-drop report builder with grouping &
 * aggregation, chart visualisation, scheduled email delivery, and multiple
 * export formats. Users pick a data source, select columns, optionally group
 * by a field with sum/avg/count/min/max aggregations, and export to CSV/PDF.
 */
const DATA_SOURCES = [
  // ── Core Operations ──
  { id: 'jobs', label: 'Jobs', entity: 'Job', icon: 'Briefcase' },
  { id: 'staff', label: 'Staff', entity: 'Staff', icon: 'Users' },
  { id: 'rotas', label: 'Rota Assignments', entity: 'RotaAssignment', icon: 'Calendar' },
  { id: 'timesheets', label: 'Timesheets', entity: 'Timesheet', icon: 'Clock' },
  { id: 'absences', label: 'Absences & Leave', entity: 'Absence', icon: 'CalendarX' },
  // ── Financial ──
  { id: 'invoices', label: 'Invoices', entity: 'Invoice', icon: 'Receipt' },
  { id: 'cost-items', label: 'Job Cost Items', entity: 'JobCostItem', icon: 'Package' },
  { id: 'daily-costs', label: 'Daily Costs', entity: 'DailyCost', icon: 'Coins' },
  { id: 'purchase-orders', label: 'Purchase Orders', entity: 'PurchaseOrder', icon: 'FileText' },
  { id: 'rate-cards', label: 'Rate Card Items', entity: 'RateCardItem', icon: 'Tag' },
  // ── Assets & Fleet ──
  { id: 'assets', label: 'Site Assets', entity: 'SiteAsset', icon: 'Wrench' },
  { id: 'vehicles', label: 'Vehicles', entity: 'Vehicle', icon: 'Truck' },
  { id: 'service-records', label: 'Service Records', entity: 'ServiceRecord', icon: 'Wrench' },
  { id: 'vehicle-maintenance', label: 'Vehicle Maintenance Bookings', entity: 'VehicleMaintenanceBooking', icon: 'Wrench' },
  // ── Logistics ──
  { id: 'deliveries', label: 'Deliveries', entity: 'DeliveryLog', icon: 'Truck' },
  // ── Geotechnical ──
  { id: 'investigation-logs', label: 'Investigation Logs', entity: 'InvestigationLog', icon: 'FlaskConical' },
  { id: 'samples', label: 'Samples', entity: 'Sample', icon: 'FlaskConical' },
  // ── Safety & Compliance ──
  { id: 'safety-reports', label: 'Safety Reports', entity: 'SafetyReport', icon: 'ShieldAlert' },
  { id: 'compliance-items', label: 'Compliance Items', entity: 'ComplianceItem', icon: 'ShieldCheck' },
  // ── Job Details ──
  { id: 'job-milestones', label: 'Job Milestones', entity: 'JobMilestone', icon: 'Flag' },
  { id: 'job-documents', label: 'Job Documents', entity: 'JobDocument', icon: 'FileText' },
  { id: 'site-photos', label: 'Site Photos', entity: 'SitePhoto', icon: 'Camera' },
  { id: 'hotel-bookings', label: 'Hotel Bookings', entity: 'HotelBooking', icon: 'Bed' },
  // ── HR & Training ──
  { id: 'training-courses', label: 'Training Courses', entity: 'TrainingCourse', icon: 'GraduationCap' },
  { id: 'training-bookings', label: 'Training Bookings', entity: 'TrainingBooking', icon: 'GraduationCap' },
  // ── Contacts ──
  { id: 'clients', label: 'Clients', entity: 'Client', icon: 'Building2' },
  { id: 'contractors', label: 'Contractors', entity: 'Contractor', icon: 'HardHat' },
  { id: 'suppliers', label: 'Suppliers', entity: 'Supplier', icon: 'Truck' },
];

// Common fields available on most entities for column selection
const COMMON_FIELDS = [
  { key: 'name', label: 'Name', numeric: false },
  { key: 'status', label: 'Status', numeric: false },
  { key: 'start_date', label: 'Start Date', numeric: false },
  { key: 'end_date', label: 'End Date', numeric: false },
  { key: 'created_date', label: 'Created Date', numeric: false },
  { key: 'budget_amount', label: 'Budget', numeric: true },
  { key: 'actual_cost', label: 'Actual Cost', numeric: true },
  { key: 'client_charge', label: 'Client Charge', numeric: true },
  { key: 'location', label: 'Location', numeric: false },
  { key: 'client_id', label: 'Client ID', numeric: false },
  { key: 'job_id', label: 'Job ID', numeric: false },
  { key: 'staff_id', label: 'Staff ID', numeric: false },
  { key: 'assigned_date', label: 'Assigned Date', numeric: false },
  { key: 'total_hours', label: 'Total Hours', numeric: true },
  { key: 'unit_cost', label: 'Unit Cost', numeric: true },
  { key: 'quantity', label: 'Quantity', numeric: true },
  { key: 'description', label: 'Description', numeric: false },
  { key: 'category', label: 'Category', numeric: false },
  { key: 'asset_type', label: 'Asset Type', numeric: false },
  { key: 'registration_number', label: 'Reg Number', numeric: false },
  { key: 'email', label: 'Email', numeric: false },
  { key: 'worker_type', label: 'Worker Type', numeric: false },
  { key: 'team_id', label: 'Team ID', numeric: false },
];

const AGG_TYPES = [
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
];

const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'donut', label: 'Donut', icon: PieChart },
];

const fmtVal = (val) => {
  if (val == null) return '';
  if (Array.isArray(val)) return val.join('; ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export default function CustomReportBuilder() {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState('jobs');
  const [selectedFields, setSelectedFields] = useState(['name', 'status', 'start_date', 'end_date', 'budget_amount', 'actual_cost']);
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [reportName, setReportName] = useState('');
  const [exporting, setExporting] = useState(null);
  const [groupBy, setGroupBy] = useState('');
  const [aggMap, setAggMap] = useState({}); // { fieldKey: 'sum'|'avg'|... }
  const [chartType, setChartType] = useState('bar');
  const [showSave, setShowSave] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState(null);

  const source = DATA_SOURCES.find(s => s.id === sourceId);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['custom-report', sourceId, dateFilter, statusFilter],
    queryFn: async () => {
      const filter = {};
      if (statusFilter) filter.status = statusFilter;
      if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
        filter.created_date = { $gte: since };
      }
      return base44.entities[source.entity].filter(filter, '-created_date', 200);
    },
    enabled: !!source,
  });

  // Grouped + aggregated data
  const { groupedRows, chartData, grandTotals } = useMemo(() => {
    if (!groupBy) return { groupedRows: null, chartData: [], grandTotals: null };

    const groups = {};
    for (const r of records) {
      const gk = fmtVal(r[groupBy]) || 'Unassigned';
      if (!groups[gk]) groups[gk] = [];
      groups[gk].push(r);
    }

    const numericFields = selectedFields.filter(f => COMMON_FIELDS.find(cf => cf.key === f)?.numeric);
    const rows = Object.entries(groups).map(([groupKey, groupRecords]) => {
      const row = { [groupBy]: groupKey, _count: groupRecords.length };
      for (const f of numericFields) {
        const agg = aggMap[f] || 'sum';
        const vals = groupRecords.map(r => Number(r[f]) || 0).filter(v => !isNaN(v));
        if (agg === 'count') row[f] = vals.length;
        else if (agg === 'sum') row[f] = vals.reduce((s, v) => s + v, 0);
        else if (agg === 'avg') row[f] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        else if (agg === 'min') row[f] = vals.length ? Math.min(...vals) : 0;
        else if (agg === 'max') row[f] = vals.length ? Math.max(...vals) : 0;
      }
      return row;
    });

    // Grand totals row
    const totals = { [groupBy]: 'GRAND TOTAL', _count: records.length };
    for (const f of numericFields) {
      const agg = aggMap[f] || 'sum';
      const vals = records.map(r => Number(r[f]) || 0).filter(v => !isNaN(v));
      if (agg === 'count') totals[f] = vals.length;
      else if (agg === 'sum') totals[f] = vals.reduce((s, v) => s + v, 0);
      else if (agg === 'avg') totals[f] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      else if (agg === 'min') totals[f] = vals.length ? Math.min(...vals) : 0;
      else if (agg === 'max') totals[f] = vals.length ? Math.max(...vals) : 0;
    }

    // Chart data — use the first numeric field for the chart value
    const firstNumeric = numericFields[0];
    const chartData = firstNumeric
      ? rows.map(r => ({ name: String(r[groupBy]).substring(0, 20), value: Math.round(Number(r[firstNumeric]) || 0) }))
      : rows.map(r => ({ name: String(r[groupBy]).substring(0, 20), value: r._count }));

    return { groupedRows: rows, chartData, grandTotals: totals };
  }, [records, groupBy, selectedFields, aggMap]);

  const displayRows = groupBy ? (groupedRows || []) : records.slice(0, 100);
  const allRows = groupBy && grandTotals ? [...(groupedRows || []), grandTotals] : displayRows;

  const toggleField = (key) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  };

  const moveField = (idx, dir) => {
    setSelectedFields(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const exportCSV = () => {
    if (allRows.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    const columns = selectedFields.map(f => ({ key: f, label: f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
    const rows = allRows.map(r => { const row = {}; selectedFields.forEach(f => { row[f] = fmtVal(r[f]); }); return row; });
    const filename = `${reportName || source.label.toLowerCase().replace(/\s/g, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadStructuredCsv(filename, columns, rows);
    toast({ title: 'Report exported', description: `${allRows.length} records exported to CSV` });
  };

  const printPDF = async () => {
    if (allRows.length === 0) { toast({ title: 'No data to print', variant: 'destructive' }); return; }
    setExporting('pdf');
    try {
      const columns = selectedFields.map(f => ({ label: f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), align: 'left', width: 1 }));
      const rows = allRows.map(r => selectedFields.map(f => fmtVal(r[f])));
      const filterSummary = [
        `Data Source: ${source.label}`,
        `Records: ${allRows.length}`,
        dateFilter !== 'all' ? `Date Range: Last ${dateFilter} days` : 'Date Range: All time',
        statusFilter ? `Status Filter: ${statusFilter}` : 'Status: All',
        groupBy ? `Grouped by: ${groupBy}` : '',
      ].filter(Boolean);
      await generateReportPdf({
        title: reportName || 'Custom Report',
        subtitle: `Source: ${source.label}`,
        filterSummary,
        sections: [{ title: reportName || source.label, columns, rows }],
      });
      toast({ title: 'PDF exported', description: `${allRows.length} records.` });
    } catch (e) { toast({ title: 'PDF export failed', variant: 'destructive' }); }
    setExporting(null);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={FileBarChart}
        title="Custom Report Builder"
        description="Build custom reports from any data source — group, aggregate, chart, and export to CSV or PDF"
        actions={
          <>
            <button onClick={() => setShowSave(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <Bookmark className="w-4 h-4" /> Save
            </button>
            <button onClick={() => { if (!savedTemplateId) { toast({ title: 'Save the report first', description: 'Save as a template before scheduling.', variant: 'destructive' }); return; } setShowSchedule(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <Clock className="w-4 h-4" /> Schedule
            </button>
            <button onClick={exportCSV} disabled={isLoading || allRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={printPDF} disabled={isLoading || allRows.length === 0 || exporting === 'pdf'}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Report config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report name */}
          <div className="hub-glass rounded-2xl p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report Name</label>
            <input
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="e.g. Weekly Job Summary"
              className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Data source */}
          <div className="hub-glass rounded-2xl p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Data Source</label>
            <SearchableSelect
              value={sourceId}
              onChange={(val) => { setSourceId(val); setGroupBy(''); setAggMap({}); }}
              options={DATA_SOURCES.map(s => ({ value: s.id, label: s.label }))}
              placeholder="Choose a data source…"
              searchPlaceholder="Search data sources…"
              emptyText="No data sources found"
            />
          </div>

          {/* Filters */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</label>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date range (created)</p>
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Status filter</p>
              <input value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                placeholder="e.g. in_progress (blank = all)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {/* Group by + aggregation */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group & Aggregate</label>
            <div>
              <p className="text-xs text-slate-500 mb-1">Group by (optional)</p>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">No grouping</option>
                {COMMON_FIELDS.filter(f => !f.numeric).map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            {groupBy && selectedFields.filter(f => COMMON_FIELDS.find(cf => cf.key === f)?.numeric).map(f => (
              <div key={f}>
                <p className="text-xs text-slate-500 mb-1">Aggregation for {f.replace(/_/g, ' ')}</p>
                <select value={aggMap[f] || 'sum'} onChange={e => setAggMap(prev => ({ ...prev, [f]: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                  {AGG_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Column selection */}
          <div className="hub-glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Columns (click to toggle)</p>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {COMMON_FIELDS.map(f => (
                <button key={f.key} onClick={() => toggleField(f.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${selectedFields.includes(f.key) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Preview + Chart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chart panel */}
          {groupBy && chartData.length > 0 && (
            <div className="hub-glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Chart Visualisation</h3>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {CHART_TYPES.map(ct => {
                    const Icon = ct.icon;
                    return (
                      <button key={ct.id} onClick={() => setChartType(ct.id)}
                        className={`p-1.5 rounded-md transition ${chartType === ct.id ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title={ct.label}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <ReportChart data={chartData} type={chartType} height={240} />
            </div>
          )}

          {/* Preview table */}
          <div className="hub-glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Preview</h3>
                <p className="text-xs text-slate-500">{source.label} · {displayRows.length} record{displayRows.length !== 1 ? 's' : ''}{groupBy ? ' (grouped)' : ''}</p>
              </div>
              {selectedFields.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">{selectedFields.length} columns</span>
                </div>
              )}
            </div>

            {/* Selected column order */}
            {selectedFields.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-1.5">
                {selectedFields.map((f, i) => (
                  <div key={f} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
                    <span className="font-medium text-slate-700">{f.replace(/_/g, ' ')}</span>
                    <button onClick={() => moveField(i, 1)} disabled={i === selectedFields.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
                    <button onClick={() => toggleField(f)} className="text-rose-400 hover:text-rose-600 ml-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : displayRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileBarChart className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No records found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters</p>
                </div>
              ) : selectedFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Plus className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Select columns to build your report</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      {selectedFields.map(f => (
                        <th key={f} className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          {f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          {groupBy && COMMON_FIELDS.find(cf => cf.key === f)?.numeric && (
                            <span className="ml-1 text-[9px] text-emerald-600 font-normal">({aggMap[f] || 'sum'})</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((r, i) => {
                      const isTotal = groupBy && r[groupBy] === 'GRAND TOTAL';
                      return (
                        <tr key={i} className={`hover:bg-slate-50 ${isTotal ? 'bg-emerald-50 font-bold border-t-2 border-emerald-200' : ''}`}>
                          {selectedFields.map(f => (
                            <td key={f} className="px-3 py-2 border-b border-slate-100 text-slate-700 max-w-xs truncate">
                              {fmtVal(r[f])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSave && (
        <ReportSaveModal
          filters={{ datePreset: dateFilter === 'all' ? '' : dateFilter + 'd', dateFrom: '', dateTo: '', divisionId: '' }}
          category="custom"
          onClose={() => setShowSave(false)}
        />
      )}
      {showSchedule && savedTemplateId && (
        <ReportScheduleModal template={{ id: savedTemplateId, name: reportName || 'Custom Report' }} onClose={() => setShowSchedule(false)} />
      )}
    </div>
  );
}