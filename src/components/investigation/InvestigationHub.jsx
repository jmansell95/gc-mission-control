import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { format } from 'date-fns';
import { CheckSquare, X, FlaskConical } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import InvestigationHeader from '@/components/investigation/InvestigationHeader';
import InvestigationGroupCard from '@/components/investigation/InvestigationGroupCard';
import InvestigationLogDrawer from '@/components/investigation/InvestigationLogDrawer';
import InvestigationExportBar from '@/components/investigation/InvestigationExportBar';
import InvestigationBulkReview from '@/components/investigation/InvestigationBulkReview';
import BulkApproveBar from '@/components/investigation/BulkApproveBar';
import LiveKeyLogFeed from '@/components/investigation/LiveKeyLogFeed';
import { getInvestigationHubDeepLink } from '@/utils/investigationDeepLink';
import { logTypeConfig } from '@/components/investigation/shared';

/**
 * Investigation Hub — single master board that managers re-group on the fly
 * (by borehole, staff member, job, or date) to review every site log and
 * borehole record, approve or reject logs per job, and export approved data
 * as downloadable AGS files (per job / per borehole / per staff) for import
 * into OpenGround. Unified responsive design across desktop, tablet, mobile.
 */
export default function InvestigationHub({ onNavigate }) {
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupBy, setGroupBy] = useState('borehole');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const queryClient = useQueryClient();

  // Bidirectional deep-link: when a manager clicks "View in Investigation Hub"
  // from a job's Site Activity tab, the target job + log id are stashed in
  // sessionStorage. On mount, read + clear it, pre-filter to that job, and
  // open the log drawer so they land exactly on the log they came from.
  useEffect(() => {
    const link = getInvestigationHubDeepLink();
    if (!link) return;
    if (link.jobId) setJobFilter(link.jobId);
    if (link.logId) setSelectedLogId(link.logId);
  }, []);

  const { data: logs = [], isLoading } = useScopedEntity('InvestigationLog', { queryKey: ['investigation-hub-logs'], sort: '-created_date', limit: 300 });
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['investigation-hub-jobs'], limit: 500 });
  const { data: staff = [] } = useQuery({ queryKey: ['investigation-hub-staff'], queryFn: () => base44.entities.Staff.list() });

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => { m[j.id] = j; }); return m; }, [jobs]);
  const staffMap = useMemo(() => { const m = {}; staff.forEach(s => { m[s.id] = s; }); return m; }, [staff]);

  // Apply filters
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (reviewFilter !== 'all' && (l.manager_review_status || 'pending') !== reviewFilter) return false;
      if (jobFilter !== 'all' && l.job_id !== jobFilter) return false;
      if (typeFilter !== 'all' && l.log_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${l.borehole_ref || ''} ${l.sample_id || ''} ${l.description || ''} ${l.strata_description_detail || ''} ${l.staff_name || ''} ${l.completed_by_name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, reviewFilter, jobFilter, typeFilter, search]);

  // Group the filtered logs by the selected dimension
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach(l => {
      let key, label;
      if (groupBy === 'borehole') {
        key = l.borehole_ref || '— No borehole —';
        label = key;
      } else if (groupBy === 'staff') {
        key = l.staff_id || l.staff_name || '— Unknown —';
        label = staffMap[l.staff_id]?.name || l.staff_name || 'Unknown staff';
      } else if (groupBy === 'job') {
        key = l.job_id || '— No job —';
        label = jobMap[l.job_id]?.name || 'Unknown job';
      } else {
        key = l.date || '— No date —';
        label = l.date ? format(new Date(l.date), 'EEEE, dd MMM yyyy') : 'No date';
      }
      if (!map[key]) map[key] = { key, label, logs: [] };
      map[key].logs.push(l);
    });
    // Sort logs within each group
    const arr = Object.values(map);
    arr.forEach(g => {
      g.logs.sort((a, b) => {
        if (groupBy === 'borehole') return (a.depth_from ?? 0) - (b.depth_from ?? 0);
        if (groupBy === 'date') return (a.borehole_ref || '').localeCompare(b.borehole_ref || '') || (a.depth_from ?? 0) - (b.depth_from ?? 0);
        return (a.date || '').localeCompare(b.date || '') || (a.depth_from ?? 0) - (b.depth_from ?? 0);
      });
    });
    // Sort groups: borehole/staff/job alphabetically, date descending
    arr.sort((a, b) => {
      if (groupBy === 'date') return b.key.localeCompare(a.key);
      return a.label.localeCompare(b.label);
    });
    return arr;
  }, [filtered, groupBy, jobMap, staffMap]);

  const selectedLog = logs.find(l => l.id === selectedLogId) || null;

  const pendingCount = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queriedCount = logs.filter(l => l.manager_review_status === 'queried').length;
  const hasNoLogs = !isLoading && logs.length === 0;

  const toggleBulkSelect = useCallback((id) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDone = () => {
    queryClient.invalidateQueries({ queryKey: ['investigation-hub-logs'] });
    queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
    setBulkSelected(new Set());
    setBulkMode(false);
  };

  return (
    <div className="relative space-y-hub-gap-sm sm:space-y-hub-gap">
      <InvestigationHeader
        totalLogs={logs.length}
        pendingCount={pendingCount}
        queriedCount={queriedCount}
        groupBy={groupBy} setGroupBy={setGroupBy}
        search={search} setSearch={setSearch}
        reviewFilter={reviewFilter} setReviewFilter={setReviewFilter}
        jobFilter={jobFilter} setJobFilter={setJobFilter} jobs={jobs}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter} logTypes={logTypeConfig}
      />

      {/* Live KeyLogBook feed — today's incoming driller logs across all jobs */}
      <LiveKeyLogFeed jobs={jobs} />

      {/* Bulk-select toggle — sits under the header */}
      {!hasNoLogs && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${bulkMode ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> {bulkMode ? 'Done selecting' : 'Select logs'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {hasNoLogs && (
        <div className="insight-card rounded-2xl p-8 text-center">
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

      {/* Export + bulk review controls — only when logs exist */}
      {!hasNoLogs && (
        <>
          <InvestigationExportBar logs={logs} jobs={jobs} staff={staff} />
          <InvestigationBulkReview logs={logs} jobs={jobs} onDone={handleBulkDone} />
        </>
      )}

      {/* Grouped board */}
      {!hasNoLogs && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="insight-card rounded-2xl p-8">
              <EmptyState icon={FlaskConical} title="No logs match your filters" message="Try adjusting the search, status, job, or type filters above." />
            </div>
          ) : (
            groups.map((g, idx) => (
              <InvestigationGroupCard
                key={g.key}
                groupLabel={g.label}
                logs={g.logs}
                groupBy={groupBy}
                staffMap={staffMap}
                jobMap={jobMap}
                selectedLogId={selectedLogId}
                onSelectLog={setSelectedLogId}
                bulkMode={bulkMode}
                bulkSelected={bulkSelected}
                toggleBulkSelect={toggleBulkSelect}
                defaultOpen={idx < 3}
              />
            ))
          )}
        </div>
      )}

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

      {/* Ad-hoc bulk approve bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <BulkApproveBar
          selectedIds={Array.from(bulkSelected)}
          onClear={() => setBulkSelected(new Set())}
          onDone={handleBulkDone}
        />
      )}
    </div>
  );
}