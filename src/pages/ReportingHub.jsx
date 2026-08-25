import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { downloadCsv } from '@/utils/csvExport';
import { Bookmark } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ReportHeroHeader from '@/components/reports/ReportHeroHeader';
import ReportStatTiles from '@/components/reports/ReportStatTiles';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import ReportSidebar, { REPORT_CATEGORIES } from '@/components/reports/ReportSidebar';
import ReportNativeSection from '@/components/reports/ReportNativeSection';
import PowerBIReportSection from '@/components/reports/PowerBIReportSection';
import ReportTemplateLibrary from '@/components/reports/ReportTemplateLibrary';
import ReportScheduleModal from '@/components/reports/ReportScheduleModal';
import ReportSaveModal from '@/components/reports/ReportSaveModal';
import CustomReportBuilder from '@/components/reports/CustomReportBuilder';
import { useReportData, filterJobsByDate } from '@/hooks/useReportData';

const HUB_MAP = { billing: 'financial', fleet: 'fleet', staff: 'staff', compliance: 'compliance', assets: 'assets', powerbi: 'powerbi' };

export default function ReportingHub() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const initialHub = params.get('hub');
  const [category, setCategory] = useState(HUB_MAP[initialHub] || 'overview');
  const [filters, setFilters] = useState({ datePreset: '30d', dateFrom: '', dateTo: '', divisionId: '' });
  const [exporting, setExporting] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [scheduleTpl, setScheduleTpl] = useState(null);
  const [showCustom, setShowCustom] = useState(false);

  const data = useReportData(filters);
  const activeCat = REPORT_CATEGORIES.find(c => c.id === category) || REPORT_CATEGORIES[0];
  const isPowerBI = category === 'powerbi';
  const isTemplates = category === 'templates';
  const isCustom = category === 'custom';

  const handleExport = async () => {
    setExporting(true);
    try {
      const q = filters.divisionId ? { division_id: filters.divisionId } : {};
      const jobs = await base44.entities.Job.filter(q, '-created_date', 500);
      const filtered = filterJobsByDate(jobs, filters.dateFrom, filters.dateTo);
      downloadCsv(`${activeCat.label.toLowerCase()}-report.csv`, filtered);
      toast({ title: 'Exported', description: `${filtered.length} records exported to CSV.` });
    } catch (e) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <ReportHeroHeader onBuildCustom={() => setShowCustom(true)} />

      {/* Summary stat tiles — hidden on Power BI / Templates / Custom tabs */}
      {!isPowerBI && !isTemplates && !isCustom && <ReportStatTiles data={data} />}

      {/* Filter bar — hidden on Templates and Custom Builder tabs */}
      {!isTemplates && !isCustom && (
        <ReportFilterBar filters={filters} setFilters={setFilters} onExport={handleExport} exporting={exporting} hubLabel={activeCat.label} />
      )}

      <div className="flex gap-4">
        <ReportSidebar category={category} setCategory={setCategory} />

        <div className="flex-1 min-w-0 space-y-4">
          {/* Save-as-template button for native categories */}
          {!isPowerBI && !isTemplates && !isCustom && (
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
            : <ReportNativeSection hub={category} filters={filters} />}
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
    </div>
  );
}