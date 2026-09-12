import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { FlaskConical, Clock, AlertTriangle, CheckCircle2, Layers, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import HubShell from '@/components/HubShell';
import InvestigationHeader from '@/components/investigation/InvestigationHeader';
import InvestigationToolbar from '@/components/investigation/InvestigationToolbar';
import InvestigationOverview from '@/components/investigation/InvestigationOverview';
import InvestigationJobView from '@/components/investigation/InvestigationJobView';
import InvestigationBoreholeDetail from '@/components/investigation/InvestigationBoreholeDetail';
import InvestigationLogDrawer from '@/components/investigation/InvestigationLogDrawer';
import InvestigationExportModal from '@/components/investigation/InvestigationExportModal';
import InvestigationBulkReviewModal from '@/components/investigation/InvestigationBulkReviewModal';
import BulkApproveBar from '@/components/investigation/BulkApproveBar';
import LiveKeyLogFeed from '@/components/investigation/LiveKeyLogFeed';
import { getInvestigationHubDeepLink } from '@/utils/investigationDeepLink';
import { logTypeConfig } from '@/components/investigation/shared';

/**
 * Investigation Hub — redesigned with hierarchical drilldown:
 *   Overview (job cards) → Job view (borehole cards) → Borehole detail
 *   (organized strata / samples / SPT / installations / remarks sections).
 *
 * The old group-by control is replaced by the natural drilldown hierarchy.
 * The old inline export bar and bulk review bar are consolidated into a
 * unified toolbar with modals. Advanced filters are behind a "Filters"
 * toggle so the header stays clean.
 */
export default function InvestigationHub({ onNavigate }) {
  // Drill state
  const [drillLevel, setDrillLevel] = useState('overview');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedBoreholeRef, setSelectedBoreholeRef] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [boreholeStatusFilter, setBoreholeStatusFilter] = useState('all');
  const [drillerFilter, setDrillerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal / bulk state
  const [showExport, setShowExport] = useState(false);
  const [showBulkReview, setShowBulkReview] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  // Log drawer
  const [selectedLogId, setSelectedLogId] = useState(null);

  const queryClient = useQueryClient();

  // Deep-link: pre-filter to a job/borehole and open a log
  useEffect(() => {
    const link = getInvestigationHubDeepLink();
    if (!link) return;
    if (link.jobId) { setSelectedJobId(link.jobId); setDrillLevel(link.jobId ? 'job' : 'overview'); }
    if (link.boreholeRef) { setSelectedBoreholeRef(link.boreholeRef); setDrillLevel('borehole'); }
    if (link.logId) setSelectedLogId(link.logId);
  }, []);

  // Data — fetch more logs when a specific job is selected
  const { data: logs = [], isLoading } = useScopedEntity('InvestigationLog', {
    queryKey: ['investigation-hub-logs', selectedJobId],
    sort: '-created_date',
    filter: selectedJobId ? { job_id: selectedJobId } : {},
    limit: selectedJobId ? 2000 : 500,
  });
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['investigation-hub-jobs'], limit: 500 });
  const { data: staff = [] } = useQuery({ queryKey: ['investigation-hub-staff'], queryFn: () => base44.entities.Staff.list() });

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => m[j.id] = j); return m; }, [jobs]);
  const staffMap = useMemo(() => { const m = {}; staff.forEach(s => m[s.id] = s); return m; }, [staff]);

  // Distinct drillers for the filter dropdown
  const drillerOptions = useMemo(() => [...new Set(logs.map(l => l.staff_name).filter(Boolean))].sort(), [logs]);

  // Borehole ref → status map (for filtering non-progress logs by borehole status)
  const boreholeRefStatusMap = useMemo(() => {
    const map = {};
    logs.forEach(l => { if (l.log_type === 'borehole_progress' && l.borehole_ref && l.borehole_status) map[l.borehole_ref] = l.borehole_status; });
    return map;
  }, [logs]);

  // Apply filters
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (reviewFilter !== 'all' && (l.manager_review_status || 'pending') !== reviewFilter) return false;
      if (typeFilter !== 'all' && l.log_type !== typeFilter) return false;
      if (boreholeStatusFilter !== 'all') {
        if (l.log_type !== 'borehole_progress' || l.borehole_status !== boreholeStatusFilter) {
          if (!boreholeRefStatusMap[l.borehole_ref] || boreholeRefStatusMap[l.borehole_ref] !== boreholeStatusFilter) return false;
        }
      }
      if (drillerFilter !== 'all' && l.staff_name !== drillerFilter) return false;
      if (dateFrom && l.date && l.date < dateFrom) return false;
      if (dateTo && l.date && l.date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${l.borehole_ref || ''} ${l.sample_id || ''} ${l.description || ''} ${l.strata_description_detail || ''} ${l.staff_name || ''} ${l.completed_by_name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, reviewFilter, typeFilter, boreholeStatusFilter, drillerFilter, dateFrom, dateTo, search, boreholeRefStatusMap]);

  // Overview: group filtered logs by job
  const jobGroups = useMemo(() => {
    const map = {};
    filtered.forEach(l => {
      const key = l.job_id || '—unassigned—';
      if (!map[key]) map[key] = { key, label: jobMap[l.job_id]?.name || 'Unassigned', logs: [] };
      map[key].logs.push(l);
    });
    return Object.values(map).map(g => ({
      ...g,
      pending: g.logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length,
      queried: g.logs.filter(l => l.manager_review_status === 'queried').length,
      approved: g.logs.filter(l => l.manager_review_status === 'approved').length,
      boreholeCount: new Set(g.logs.map(l => l.borehole_ref).filter(Boolean)).size,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, jobMap]);

  // Job view: group filtered logs (within selected job) by borehole
  const boreholeGroups = useMemo(() => {
    if (!selectedJobId) return [];
    const jobLogs = filtered.filter(l => l.job_id === selectedJobId);
    const map = {};
    jobLogs.forEach(l => {
      const key = l.borehole_ref || '— No borehole —';
      if (!map[key]) map[key] = { ref: key, logs: [] };
      map[key].logs.push(l);
    });
    return Object.values(map).map(bh => {
      const progressLog = bh.logs.find(l => l.log_type === 'borehole_progress' && l.borehole_status);
      const hasRemarks = bh.logs.some(l => l.source === 'keylogbook_remarks');
      return {
        ...bh,
        status: progressLog?.borehole_status || null,
        drillingMethod: progressLog?.drilling_method || null,
        maxDepth: bh.logs.reduce((m, l) => l.depth_to != null ? Math.max(m, l.depth_to) : m, 0),
        pending: bh.logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length,
        queried: bh.logs.filter(l => l.manager_review_status === 'queried').length,
        approved: bh.logs.filter(l => l.manager_review_status === 'approved').length,
        missingDataCount: [
          bh.logs.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other').length === 0 && 'strata',
          bh.logs.filter(l => l.sample_id).length === 0 && 'samples',
          bh.logs.filter(l => l.spt_n_value != null || (l.spt_blows?.length > 0)).length === 0 && 'spt',
          bh.logs.filter(l => l.log_type === 'installation').length === 0 && 'installations',
          !hasRemarks && 'remarks',
          (bh.logs.reduce((m, l) => l.depth_to != null ? Math.max(m, l.depth_to) : m, 0) === 0) && 'finalDepth',
        ].filter(Boolean).length,
      };
    }).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [filtered, selectedJobId]);

  // Borehole detail: logs for the selected borehole
  const boreholeLogs = useMemo(() => {
    if (!selectedJobId || !selectedBoreholeRef) return [];
    return filtered.filter(l => l.job_id === selectedJobId && (l.borehole_ref || '— No borehole —') === selectedBoreholeRef);
  }, [filtered, selectedJobId, selectedBoreholeRef]);

  const selectedLog = logs.find(l => l.id === selectedLogId) || null;
  const selectedJob = selectedJobId ? jobMap[selectedJobId] : null;

  const pendingCount = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queriedCount = logs.filter(l => l.manager_review_status === 'queried').length;
  const approvedCount = logs.filter(l => l.manager_review_status === 'approved').length;
  const boreholesCovered = new Set(logs.map(l => l.borehole_ref).filter(Boolean)).size;
  const hasNoLogs = !isLoading && logs.length === 0;

  const toggleBulkSelect = useCallback((id) => {
    setBulkSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleBulkDone = () => {
    queryClient.invalidateQueries({ queryKey: ['investigation-hub-logs'] });
    queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
    setBulkSelected(new Set());
    setBulkMode(false);
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId === '—unassigned—' ? null : jobId);
    setSelectedBoreholeRef(null);
    setDrillLevel('job');
    setBulkMode(false); setBulkSelected(new Set());
  };

  const handleSelectBorehole = (ref) => {
    setSelectedBoreholeRef(ref);
    setDrillLevel('borehole');
    setBulkMode(false); setBulkSelected(new Set());
  };

  const handleBackToOverview = () => {
    setDrillLevel('overview'); setSelectedJobId(null); setSelectedBoreholeRef(null);
    setBulkMode(false); setBulkSelected(new Set());
  };

  const handleBackToJob = () => {
    setDrillLevel('job'); setSelectedBoreholeRef(null);
    setBulkMode(false); setBulkSelected(new Set());
  };

  return (
    <HubShell
      hubKey="investigation"
      icon={FlaskConical}
      eyebrow="Investigation Hub"
      title="Investigation Hub"
      subtitle="Borehole data, site logs, geotech QC & AGS / KeyLogBook review"
      breadcrumbs={[{ label: 'Investigation Hub' }]}
      stats={[
        { icon: FlaskConical, label: 'Total Logs', value: logs.length, color: 'blue' },
        { icon: Clock, label: 'Pending', value: pendingCount, color: 'amber' },
        { icon: AlertTriangle, label: 'Queried', value: queriedCount, color: 'rose' },
        { icon: CheckCircle2, label: 'Approved', value: approvedCount, color: 'emerald' },
        { icon: Layers, label: 'Boreholes', value: boreholesCovered, color: 'violet' },
      ]}
      help={{
        title: 'Investigation Hub — how it works',
        topics: [
          { title: 'Drilldown', summary: 'Navigate Jobs → Boreholes → Detail.', body: 'Click a job card to see its boreholes. Click a borehole to see organized strata, samples, SPT, installations, and driller remarks. Use the breadcrumb to navigate back.' },
          { title: 'Review Workflow', summary: 'Approve, query, or reject logs.', body: 'Click any log to open the detail drawer. Review the data, then approve or query. Use Bulk Review to approve/query all pending logs in a job at once. Use Select mode to pick individual logs.' },
          { title: 'KeyLogBook Sync', summary: 'Automatic borehole data from KeyLogBook.', body: 'AGS files pushed from KeyLogBook are automatically imported. The live feed on the overview shows today\u2019s incoming driller logs.' },
          { title: 'Export', summary: 'Export approved data to AGS or OpenGround.', body: 'Click Export in the toolbar to download approved logs as an AGS file (per job, borehole, or staff) or push directly to OpenGround.' },
        ],
      }}
      onboarding={{
        title: 'Welcome to the Investigation Hub',
        description: 'Review, approve, and export all your borehole and site log data.',
        steps: ['Click a job card to drill into its boreholes', 'Click a borehole to see organized strata, samples, SPT, and remarks', 'Review and approve logs individually or in bulk', 'Export approved data to AGS or push to OpenGround'],
      }}
    >
      {/* Breadcrumb */}
      {drillLevel !== 'overview' && (
        <div className="flex items-center gap-1.5 mb-3 text-sm flex-wrap">
          <button onClick={handleBackToOverview} className="text-slate-500 hover:text-slate-700 font-medium transition">All Jobs</button>
          {drillLevel === 'job' && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className="font-bold text-slate-900 truncate">{selectedJob?.name || 'Job'}</span>
            </>
          )}
          {drillLevel === 'borehole' && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <button onClick={handleBackToJob} className="text-slate-500 hover:text-slate-700 font-medium transition truncate">{selectedJob?.name || 'Job'}</button>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className="font-mono font-bold text-slate-900">{selectedBoreholeRef}</span>
            </>
          )}
        </div>
      )}

      {/* Filter header */}
      <InvestigationHeader
        search={search} setSearch={setSearch}
        reviewFilter={reviewFilter} setReviewFilter={setReviewFilter}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter} logTypes={logTypeConfig}
        boreholeStatusFilter={boreholeStatusFilter} setBoreholeStatusFilter={setBoreholeStatusFilter}
        drillerFilter={drillerFilter} setDrillerFilter={setDrillerFilter} drillerOptions={drillerOptions}
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
      />

      {/* Unified toolbar */}
      <InvestigationToolbar
        hasLogs={!hasNoLogs}
        jobs={jobs}
        bulkMode={bulkMode}
        pendingCount={pendingCount}
        showSelect={drillLevel === 'borehole'}
        onToggleBulk={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
        onOpenExport={() => setShowExport(true)}
        onOpenBulkReview={() => setShowBulkReview(true)}
      />

      {/* Live feed — only on overview */}
      {drillLevel === 'overview' && !hasNoLogs && <LiveKeyLogFeed jobs={jobs} />}

      {/* Empty state */}
      {hasNoLogs && (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No logs in the system</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            All site log data comes from <span className="font-semibold text-slate-700">KeyLogBook Sync</span>.
            Once data is synced, logs will appear here for review, approval, and export.
          </p>
        </div>
      )}

      {/* Content by drill level */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : drillLevel === 'overview' && !hasNoLogs ? (
        <InvestigationOverview groups={jobGroups} jobMap={jobMap} onSelectJob={handleSelectJob} />
      ) : drillLevel === 'job' ? (
        <InvestigationJobView boreholes={boreholeGroups} onSelectBorehole={handleSelectBorehole} />
      ) : drillLevel === 'borehole' ? (
        <InvestigationBoreholeDetail
          boreholeRef={selectedBoreholeRef}
          logs={boreholeLogs}
          jobName={selectedJob?.name || '—'}
          staffMap={staffMap}
          bulkMode={bulkMode}
          bulkSelected={bulkSelected}
          toggleBulkSelect={toggleBulkSelect}
          onSelectLog={setSelectedLogId}
        />
      ) : null}

      {/* Log detail drawer */}
      {selectedLog && !bulkMode && (
        <InvestigationLogDrawer
          log={selectedLog}
          jobName={jobMap[selectedLog.job_id]?.name || '—'}
          allLogs={logs}
          onClose={() => setSelectedLogId(null)}
          onReviewed={handleBulkDone}
        />
      )}

      {/* Bulk approve bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <BulkApproveBar
          selectedIds={Array.from(bulkSelected)}
          onClear={() => setBulkSelected(new Set())}
          onDone={handleBulkDone}
        />
      )}

      {/* Modals */}
      <InvestigationExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        logs={logs}
        jobs={jobs}
        staff={staff}
      />
      <InvestigationBulkReviewModal
        open={showBulkReview}
        onClose={() => setShowBulkReview(false)}
        logs={logs}
        jobs={jobs}
        onDone={handleBulkDone}
      />
    </HubShell>
  );
}