import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import { useToast } from '@/components/ui/use-toast';
import HubShell from '@/components/HubShell';
import { REPORTS_HELP_TOPICS, REPORTS_ONBOARDING, REPORTS_QUICK_LINKS } from '@/components/reports/reportsHubContent';
import ReportStatTiles from '@/components/reports/ReportStatTiles';
import UniversalReportFilters from '@/components/reports/UniversalReportFilters';
import ReportSidebar, { REPORT_CATEGORIES } from '@/components/reports/ReportSidebar';
import ReportNativeSection from '@/components/reports/ReportNativeSection';
import RigPerformanceReport from '@/components/reports/RigPerformanceReport';
import CrewPerformanceReport from '@/components/reports/CrewPerformanceReport';
import PowerBIReportSection from '@/components/reports/PowerBIReportSection';
import ReportTemplateLibrary from '@/components/reports/ReportTemplateLibrary';
import ReportScheduleModal from '@/components/reports/ReportScheduleModal';
import ReportSaveModal from '@/components/reports/ReportSaveModal';
import CustomReportBuilder from '@/components/reports/CustomReportBuilder';
import ComplianceChecksReport from '@/components/reports/ComplianceChecksReport';
import { useReportData, filterJobsByDate } from '@/hooks/useReportData';
import { Bookmark, FileBarChart, Sparkles } from 'lucide-react';

const HUB_MAP = { billing: 'financial', fleet: 'fleet', staff: 'staff', compliance: 'compliance', assets: 'assets', powerbi: 'powerbi' };

export default function ReportingHub() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const initialHub = params.get('hub');
  const [category, setCategory] = useState(HUB_MAP[initialHub] || 'overview');
  const [filters, setFilters] = useState({ datePreset: '30d', dateFrom: '', dateTo: '', divisionId: '', teamId: '', clientId: '', jobTypeId: '' });
  const [exporting, setExporting] = useState(null);
  const [showSave, setShowSave] = useState(false);
  const [scheduleTpl, setScheduleTpl] = useState(null);
  const [showCustom, setShowCustom] = useState(false);

  const data = useReportData(filters);
  const activeCat = REPORT_CATEGORIES.find(c => c.id === category) || REPORT_CATEGORIES[0];
  const isPowerBI = category === 'powerbi';
  const isTemplates = category === 'templates';
  const isCustom = category === 'custom';
  const isRigPerf = category === 'rig_performance';
  const isCrewPerf = category === 'crew_performance';
  const isSpecial = isPowerBI || isTemplates || isCustom || isRigPerf || isCrewPerf;

  // Apply date preset to get actual date range
  const getEffectiveDateRange = () => {
    if (filters.datePreset === 'custom') return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
    const today = new Date().toISOString().slice(0, 10);
    if (filters.datePreset === 'today') return { dateFrom: today, dateTo: today };
    if (filters.datePreset === '7d') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    if (filters.datePreset === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 29);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    if (filters.datePreset === 'quarter') {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      const to = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
    }
    return { dateFrom: '', dateTo: '' };
  };

  const effectiveFilters = { ...filters, ...getEffectiveDateRange() };

  const handleExportCsv = async () => {
    setExporting('csv');
    try {
      const q = filters.divisionId ? { division_id: filters.divisionId } : {};
      const jobs = await base44.entities.Job.filter(q, '-created_date', 500);
      const filtered = filterJobsByDate(jobs, effectiveFilters.dateFrom, effectiveFilters.dateTo);

      // Apply team/client/jobType filters
      let result = filtered;
      if (filters.clientId) result = result.filter(j => j.client_id === filters.clientId);
      if (filters.jobTypeId) result = result.filter(j => j.job_type === filters.jobTypeId);

      const columns = [
        { key: 'name', label: 'Job Name' },
        { key: 'status', label: 'Status' },
        { key: 'job_type', label: 'Job Type' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'client_charge', label: 'Client Charge (GBP)' },
        { key: 'actual_cost', label: 'Actual Cost (GBP)' },
      ];
      const rows = result.map(j => ({
        name: j.name || '', status: j.status || '', job_type: j.job_type || '',
        start_date: j.start_date || '', end_date: j.end_date || '',
        client_charge: Math.round(Number(j.client_charge) || 0),
        actual_cost: Math.round(Number(j.actual_cost) || 0),
      }));
      downloadStructuredCsv(`${activeCat.label.toLowerCase()}-report.csv`, columns, rows);
      toast({ title: 'Exported', description: `${rows.length} records exported to CSV.` });
    } catch (e) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const q = filters.divisionId ? { division_id: filters.divisionId } : {};
      const jobs = await base44.entities.Job.filter(q, '-created_date', 500);
      const filtered = filterJobsByDate(jobs, effectiveFilters.dateFrom, effectiveFilters.dateTo);
      let result = filtered;
      if (filters.clientId) result = result.filter(j => j.client_id === filters.clientId);
      if (filters.jobTypeId) result = result.filter(j => j.job_type === filters.jobTypeId);

      const divisionName = data.divisions?.find(d => d.id === filters.divisionId)?.name;
      const filterSummary = buildFilterSummary(effectiveFilters, divisionName, null, null, filters.jobTypeId);

      const columns = [
        { label: 'Job Name', align: 'left', width: 2.5 },
        { label: 'Status', align: 'left', width: 1 },
        { label: 'Type', align: 'left', width: 1.2 },
        { label: 'Start', align: 'left', width: 1 },
        { label: 'End', align: 'left', width: 1 },
        { label: 'Charge', align: 'right', width: 1.2 },
        { label: 'Cost', align: 'right', width: 1.2 },
      ];
      const rows = result.map(j => [
        j.name || '—', j.status || '—', (j.job_type || '—').replace(/_/g, ' '),
        j.start_date || '—', j.end_date || '—',
        '£' + Math.round(Number(j.client_charge) || 0).toLocaleString('en-GB'),
        '£' + Math.round(Number(j.actual_cost) || 0).toLocaleString('en-GB'),
      ]);
      const totals = ['Total', '', '', '', '',
        '£' + Math.round(result.reduce((s, j) => s + (Number(j.client_charge) || 0), 0)).toLocaleString('en-GB'),
        '£' + Math.round(result.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0)).toLocaleString('en-GB'),
      ];

      await generateReportPdf({
        title: `${activeCat.label} Report`,
        subtitle: 'GC Mission Control',
        filterSummary,
        sections: [{ title: activeCat.label, columns, rows, totals }],
      });
      toast({ title: 'PDF exported', description: `${result.length} records.` });
    } catch (e) {
      toast({ title: 'PDF export failed', variant: 'destructive' });
    }
    setExporting(null);
  };

  return (
    <HubShell
      hubKey="reports"
      icon={FileBarChart}
      eyebrow="Reports Hub"
      title="Reporting Hub"
      subtitle="Unified analytics across every hub — financials, fleet, staff, compliance, assets and more."
      breadcrumbs={[{ label: 'Reports Hub' }]}
      actions={
        <button
          onClick={() => setShowCustom(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#2E5A1A] text-white rounded-xl text-xs font-semibold hover:bg-[#244715] active:scale-[0.97] transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" /> Build Custom Report
        </button>
      }
      help={{ title: 'Reports Hub — how it works', topics: REPORTS_HELP_TOPICS }}
      onboarding={REPORTS_ONBOARDING}
      quickLinks={REPORTS_QUICK_LINKS}
    >
      {/* Summary stat tiles — hidden on special tabs */}
      {!isPowerBI && !isTemplates && !isCustom && !isRigPerf && !isCrewPerf && <ReportStatTiles data={data} />}

      {/* Filter bar — hidden on Templates and Custom Builder tabs */}
      {!isTemplates && !isCustom && (
        <UniversalReportFilters
          filters={filters}
          setFilters={setFilters}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          exporting={exporting}
          hubLabel={activeCat.label}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <ReportSidebar category={category} setCategory={setCategory} />

        <div className="flex-1 min-w-0 space-y-4">
          {/* Save-as-template button for native categories */}
          {!isPowerBI && !isTemplates && !isCustom && !isRigPerf && !isCrewPerf && (
            <div className="flex justify-end">
              <button onClick={() => setShowSave(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#2E5A1A] hover:text-[#2E5A1A] text-slate-600 text-xs font-semibold transition">
                <Bookmark className="w-3.5 h-3.5" /> Save as Template
              </button>
            </div>
          )}

          {isPowerBI ? <PowerBIReportSection />
            : isTemplates ? <ReportTemplateLibrary onSchedule={setScheduleTpl} onBuildCustom={() => setShowCustom(true)} />
            : isCustom ? <CustomReportBuilder />
            : isRigPerf ? <RigPerformanceReport filters={effectiveFilters} />
            : isCrewPerf ? <CrewPerformanceReport filters={effectiveFilters} />
            : <>
              <ReportNativeSection hub={category} filters={effectiveFilters} />
              {category === 'compliance' && <ComplianceChecksReport filters={effectiveFilters} />}
            </>}
        </div>
      </div>

      {showSave && <ReportSaveModal filters={filters} category={category} onClose={() => setShowSave(false)} />}
      {scheduleTpl && <ReportScheduleModal template={scheduleTpl} onClose={() => setScheduleTpl(null)} />}
      {showCustom && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm overflow-y-auto" onClick={() => setShowCustom(false)}>
          <div className="min-h-full flex items-start justify-center p-4">
            <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl my-8 animate-pop-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
                <h2 className="text-lg font-bold text-slate-900">Custom Report Builder</h2>
                <button onClick={() => setShowCustom(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition">Close</button>
              </div>
              <div className="p-6">
                <CustomReportBuilder />
              </div>
            </div>
          </div>
        </div>
      )}
    </HubShell>
  );
}