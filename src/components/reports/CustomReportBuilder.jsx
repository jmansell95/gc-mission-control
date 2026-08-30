import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileBarChart, Plus, Trash2, Download, Loader2, Settings2, FileText } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchableSelect from '@/components/SearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { format, parseISO, subDays, isWithinInterval } from 'date-fns';

/**
 * Custom Report Builder — drag-and-drop report builder with scheduled email
 * delivery and multiple export formats. Users pick a data source, select
 * columns, apply filters, and export to CSV or print to PDF.
 */
const DATA_SOURCES = [
  // ── Core Operations ──
  { id: 'jobs', label: 'Jobs', entity: 'Job', icon: 'Briefcase' },
  { id: 'projects', label: 'Projects', entity: 'Project', icon: 'FolderKanban' },
  { id: 'staff', label: 'Staff', entity: 'Staff', icon: 'Users' },
  { id: 'teams', label: 'Teams', entity: 'Team', icon: 'Users' },
  { id: 'rotas', label: 'Rota Assignments', entity: 'RotaAssignment', icon: 'Calendar' },
  { id: 'timesheets', label: 'Timesheets', entity: 'Timesheet', icon: 'Clock' },
  { id: 'absences', label: 'Absences & Leave', entity: 'Absence', icon: 'CalendarX' },
  // ── Financial ──
  { id: 'invoices', label: 'Invoices', entity: 'Invoice', icon: 'Receipt' },
  { id: 'cost-items', label: 'Job Cost Items', entity: 'JobCostItem', icon: 'Package' },
  { id: 'daily-costs', label: 'Daily Costs', entity: 'DailyCost', icon: 'Coins' },
  { id: 'purchase-orders', label: 'Purchase Orders', entity: 'PurchaseOrder', icon: 'FileText' },
  { id: 'subcontractor-logs', label: 'Subcontractor Logs', entity: 'SubcontractorLog', icon: 'HardHat' },
  { id: 'job-billing-contracts', label: 'Billing Contracts', entity: 'JobBillingContract', icon: 'ScrollText' },
  { id: 'rate-cards', label: 'Rate Card Items', entity: 'RateCardItem', icon: 'Tag' },
  { id: 'billing-rules', label: 'Billing Rules', entity: 'BillingRule', icon: 'Banknote' },
  { id: 'boq', label: 'Bill of Quantities', entity: 'JobBillOfQuantities', icon: 'ListChecks' },
  // ── Assets & Fleet ──
  { id: 'assets', label: 'Site Assets', entity: 'SiteAsset', icon: 'Wrench' },
  { id: 'vehicles', label: 'Vehicles', entity: 'Vehicle', icon: 'Truck' },
  { id: 'service-records', label: 'Service Records', entity: 'ServiceRecord', icon: 'Wrench' },
  { id: 'scrap-logs', label: 'Scrap Logs', entity: 'ScrapLog', icon: 'Trash2' },
  { id: 'asset-returns', label: 'Asset Returns', entity: 'AssetReturnLog', icon: 'PackageCheck' },
  { id: 'asset-manifests', label: 'Asset Manifests', entity: 'AssetManifest', icon: 'QrCode' },
  { id: 'equipment-calibrations', label: 'Equipment Calibrations', entity: 'EquipmentCalibration', icon: 'Gauge' },
  { id: 'vehicle-maintenance', label: 'Vehicle Maintenance Bookings', entity: 'VehicleMaintenanceBooking', icon: 'Wrench' },
  { id: 'vehicle-location-logs', label: 'Vehicle Location Logs', entity: 'VehicleLocationLog', icon: 'MapPin' },
  { id: 'geofence-events', label: 'Geofence Events', entity: 'GeofenceEvent', icon: 'MapPin' },
  // ── Logistics ──
  { id: 'deliveries', label: 'Deliveries', entity: 'DeliveryLog', icon: 'Truck' },
  { id: 'delivery-legs', label: 'Delivery Legs', entity: 'DeliveryLeg', icon: 'Route' },
  // ── Geotechnical ──
  { id: 'investigation-logs', label: 'Investigation Logs', entity: 'InvestigationLog', icon: 'FlaskConical' },
  { id: 'investigation-sors', label: 'Investigation SORs', entity: 'InvestigationSOR', icon: 'ClipboardList' },
  { id: 'samples', label: 'Samples', entity: 'Sample', icon: 'FlaskConical' },
  { id: 'lab-results', label: 'Lab Test Results', entity: 'LabTestResult', icon: 'FlaskConical' },
  { id: 'monitoring-wells', label: 'Monitoring Wells', entity: 'MonitoringWell', icon: 'Database' },
  // ── Safety & Compliance ──
  { id: 'safety-reports', label: 'Safety Reports', entity: 'SafetyReport', icon: 'ShieldAlert' },
  { id: 'toolbox-talks', label: 'Toolbox Talks', entity: 'ToolboxTalk', icon: 'MessageSquare' },
  { id: 'environmental-reports', label: 'Environmental Reports', entity: 'EnvironmentalReport', icon: 'Leaf' },
  { id: 'compliance-items', label: 'Compliance Items', entity: 'ComplianceItem', icon: 'ShieldCheck' },
  { id: 'briefing-signatures', label: 'Briefing Signatures', entity: 'BriefingSignature', icon: 'PenLine' },
  // ── Job Details ──
  { id: 'job-milestones', label: 'Job Milestones', entity: 'JobMilestone', icon: 'Flag' },
  { id: 'job-comments', label: 'Job Comments', entity: 'JobComment', icon: 'MessageSquare' },
  { id: 'job-documents', label: 'Job Documents', entity: 'JobDocument', icon: 'FileText' },
  { id: 'site-photos', label: 'Site Photos', entity: 'SitePhoto', icon: 'Camera' },
  { id: 'job-delay-logs', label: 'Job Delay Logs', entity: 'JobDelayLog', icon: 'Clock' },
  { id: 'hotel-bookings', label: 'Hotel Bookings', entity: 'HotelBooking', icon: 'Bed' },
  // ── HR & Training ──
  { id: 'staff-reviews', label: 'Staff Reviews', entity: 'StaffReview', icon: 'Star' },
  { id: 'holiday-accruals', label: 'Absence Accruals', entity: 'HolidayPayAccrual', icon: 'CalendarDays' },
  { id: 'training-courses', label: 'Training Courses', entity: 'TrainingCourse', icon: 'GraduationCap' },
  { id: 'training-bookings', label: 'Training Bookings', entity: 'TrainingBooking', icon: 'GraduationCap' },
  { id: 'incentive-scores', label: 'Incentive Scores', entity: 'IncentiveScore', icon: 'Trophy' },
  { id: 'achievements', label: 'Achievements', entity: 'Achievement', icon: 'Award' },
  { id: 'ts-delegations', label: 'Timesheet Delegations', entity: 'TimesheetDelegation', icon: 'UserCheck' },
  // ── Contacts ──
  { id: 'clients', label: 'Clients', entity: 'Client', icon: 'Building2' },
  { id: 'contractors', label: 'Contractors', entity: 'Contractor', icon: 'HardHat' },
  { id: 'suppliers', label: 'Suppliers', entity: 'Supplier', icon: 'Truck' },
  // ── Audit & System ──
  { id: 'financial-audit-logs', label: 'Financial Audit Logs', entity: 'FinancialAuditLog', icon: 'History' },
  { id: 'client-feedback', label: 'Client Feedback', entity: 'ClientFeedback', icon: 'Star' },
  { id: 'weather-logs', label: 'Weather Logs', entity: 'WeatherLog', icon: 'Cloud' },
  { id: 'bank-holidays', label: 'Bank Holidays', entity: 'BankHoliday', icon: 'Calendar' },
  { id: 'rota-weeks', label: 'Rota Weeks', entity: 'RotaWeek', icon: 'Calendar' },
  { id: 'staff-shifts', label: 'Staff Shifts', entity: 'StaffShift', icon: 'Clock' },
  { id: 'overtime-rates', label: 'Overtime Rates', entity: 'OvertimeRate', icon: 'Timer' },
  { id: 'custom-fields', label: 'Custom Fields', entity: 'CustomField', icon: 'Settings2' },
  { id: 'help-topics', label: 'Help Topics', entity: 'HelpTopic', icon: 'HelpCircle' },
];

// Common fields available on most entities for column selection
const COMMON_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'created_date', label: 'Created Date' },
  { key: 'updated_date', label: 'Updated Date' },
  { key: 'budget_amount', label: 'Budget' },
  { key: 'actual_cost', label: 'Actual Cost' },
  { key: 'location', label: 'Location' },
  { key: 'client_id', label: 'Client ID' },
  { key: 'job_id', label: 'Job ID' },
  { key: 'staff_id', label: 'Staff ID' },
  { key: 'assigned_date', label: 'Assigned Date' },
  { key: 'week_start', label: 'Week Start' },
  { key: 'total_hours', label: 'Total Hours' },
  { key: 'unit_cost', label: 'Unit Cost' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'asset_type', label: 'Asset Type' },
  { key: 'registration_number', label: 'Reg Number' },
  { key: 'email', label: 'Email' },
  { key: 'worker_type', label: 'Worker Type' },
  { key: 'team_id', label: 'Team ID' },
];

export default function CustomReportBuilder() {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState('jobs');
  const [selectedFields, setSelectedFields] = useState(['name', 'status', 'start_date', 'end_date', 'budget_amount', 'actual_cost']);
  const [dateFilter, setDateFilter] = useState('all'); // all | 7 | 30 | 90
  const [statusFilter, setStatusFilter] = useState('');
  const [reportName, setReportName] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [exporting, setExporting] = useState(null);

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

  const filteredRecords = useMemo(() => {
    return records.slice(0, 100);
  }, [records]);

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
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

  const fmtVal = (val) => {
    if (val == null) return '';
    if (Array.isArray(val)) return val.join('; ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const exportCSV = () => {
    if (filteredRecords.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }
    const columns = selectedFields.map(f => ({
      key: f,
      label: f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }));
    const rows = filteredRecords.map(r => {
      const row = {};
      selectedFields.forEach(f => { row[f] = fmtVal(r[f]); });
      return row;
    });
    const filename = `${reportName || source.label.toLowerCase().replace(/\s/g, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadStructuredCsv(filename, columns, rows);
    toast({ title: 'Report exported', description: `${filteredRecords.length} records exported to CSV` });
  };

  const printPDF = async () => {
    if (filteredRecords.length === 0) {
      toast({ title: 'No data to print', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const columns = selectedFields.map(f => ({
        label: f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        align: 'left',
        width: 1,
      }));
      const rows = filteredRecords.map(r => selectedFields.map(f => fmtVal(r[f])));

      const filterSummary = [
        `Data Source: ${source.label}`,
        `Records: ${filteredRecords.length}`,
        dateFilter !== 'all' ? `Date Range: Last ${dateFilter} days` : 'Date Range: All time',
        statusFilter ? `Status Filter: ${statusFilter}` : 'Status: All',
      ];

      await generateReportPdf({
        title: reportName || 'Custom Report',
        subtitle: `Source: ${source.label}`,
        filterSummary,
        sections: [{ title: reportName || source.label, columns, rows }],
      });
      toast({ title: 'PDF exported', description: `${filteredRecords.length} records.` });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={FileBarChart}
        title="Custom Report Builder"
        description="Build custom reports from any data source — pick columns, filter, and export to CSV or PDF"
        actions={
          <>
            <button onClick={exportCSV} disabled={isLoading || filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={printPDF} disabled={isLoading || filteredRecords.length === 0 || exporting === 'pdf'}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50">
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Report config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Report name */}
          <div className="insight-card rounded-2xl p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report Name</label>
            <input
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="e.g. Weekly Job Summary"
              className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Data source */}
          <div className="insight-card rounded-2xl p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Data Source</label>
            <SearchableSelect
              value={sourceId}
              onChange={(val) => { setSourceId(val); setPreviewData(null); }}
              options={DATA_SOURCES.map(s => ({ value: s.id, label: s.label }))}
              placeholder="Choose a data source…"
              searchPlaceholder="Search data sources…"
              emptyText="No data sources found"
            />
          </div>

          {/* Filters */}
          <div className="insight-card rounded-2xl p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</label>
            <div>
              <p className="text-xs text-slate-500 mb-1">Date range (created)</p>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Status filter</p>
              <input
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                placeholder="e.g. in_progress (blank = all)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Column selection */}
          <div className="insight-card rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Columns (click to toggle)</p>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {COMMON_FIELDS.map(f => (
                <button
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                    selectedFields.includes(f.key)
                      ? 'bg-[#2E5A1A] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2 insight-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Preview</h3>
              <p className="text-xs text-slate-500">{source.label} · {filteredRecords.length} records</p>
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
                <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
              </div>
            ) : filteredRecords.length === 0 ? (
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
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-50">
                      {selectedFields.map(f => {
                        const val = r[f];
                        let display = '';
                        if (val == null) display = '';
                        else if (Array.isArray(val)) display = val.join('; ');
                        else if (typeof val === 'object') display = JSON.stringify(val).substring(0, 40) + '…';
                        else display = String(val);
                        return (
                          <td key={f} className="px-3 py-2 border-b border-slate-100 text-slate-700 max-w-xs truncate">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}