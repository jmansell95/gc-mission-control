import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ArrowDownToLine, TestTube, MapPin, Package, Wrench, Undo2, Ruler,
  Droplets, Calculator, Layers, Gauge, Waves, Camera, FileText, Eye,
  Tablet, User, Download, Loader2, Filter, ChevronDown, HardHat,
  Activity, Search, UploadCloud,
} from 'lucide-react';
import {
  strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig,
  getMissingFields, getAnomalyFlags,
} from './shared';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => n != null ? (Number(n).toFixed(n % 1 === 0 ? 0 : 1)) : '—';

export default function LogQualityControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [originFilter, setOriginFilter] = useState('all'); // all | staff | ags_import
  const [crewFilter, setCrewFilter] = useState('all'); // all | internal | enabling | subcontractor
  const [jobFilter, setJobFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [queryReason, setQueryReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportJobId, setExportJobId] = useState('all');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [opengroundConnected, setOpengroundConnected] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  const queryReasons = [
    'Inconsistent strata description',
    'Missing photo evidence',
    'Out-of-range depth',
    'SPT value anomaly',
    'Missing mandatory field',
    'Water level discrepancy',
    'Core recovery mismatch',
    'Refusal cause unclear',
    'Other (see note)',
  ];

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['log-quality-control'],
    queryFn: async () => {
      const all = await base44.entities.InvestigationLog.list('-created_date', 500);
      return all.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-log-qc'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  // Check if OpenGround is configured
  const { data: opengroundSettings } = useQuery({
    queryKey: ['openground-config-qc'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'openground_config' }, '-created_date', 1),
  });

  useEffect(() => {
    const cfg = opengroundSettings?.[0]?.value;
    setOpengroundConnected(!!(cfg?.client_id && cfg?.client_secret));
  }, [opengroundSettings]);

  const jobMap = useMemo(() => {
    const m = {};
    jobs.forEach(j => { m[j.id] = j; });
    return m;
  }, [jobs]);

  const filteredLogs = useMemo(() => {
    let result = logs.filter(l => {
      if (filter !== 'all' && (l.manager_review_status || 'pending') !== filter) return false;
      if (originFilter !== 'all' && (l.source || 'staff') !== originFilter) return false;
      if (crewFilter !== 'all' && (l.crew_type || 'internal') !== crewFilter) return false;
      if (jobFilter !== 'all' && l.job_id !== jobFilter) return false;
      if (anomalyOnly && getAnomalyFlags(l).length === 0 && getMissingFields(l).length === 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches = (l.borehole_ref || '').toLowerCase().includes(q) ||
          (l.sample_id || '').toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q) ||
          (l.strata_description_detail || '').toLowerCase().includes(q) ||
          (l.staff_name || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
    if (sortBy === 'depth') {
      result = [...result].sort((a, b) => (b.depth_to || 0) - (a.depth_to || 0));
    } else if (sortBy === 'borehole') {
      result = [...result].sort((a, b) => (a.borehole_ref || 'zzz').localeCompare(b.borehole_ref || 'zzz'));
    } else if (sortBy === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    return result;
  }, [logs, filter, originFilter, crewFilter, jobFilter, anomalyOnly, search, sortBy]);

  const stats = useMemo(() => {
    const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
    const approved = logs.filter(l => l.manager_review_status === 'approved').length;
    const queried = logs.filter(l => l.manager_review_status === 'queried').length;
    const withAnomalies = logs.filter(l => getAnomalyFlags(l).length > 0).length;
    const incomplete = logs.filter(l => getMissingFields(l).length > 0).length;
    const agsImported = logs.filter(l => l.source === 'ags_import').length;
    // Total meters drilled = sum of max depth per borehole
    const maxDepthByRef = {};
    logs.filter(l => l.log_type === 'borehole_progress' && l.borehole_ref && l.depth_to != null).forEach(l => {
      if (!maxDepthByRef[l.borehole_ref] || l.depth_to > maxDepthByRef[l.borehole_ref]) {
        maxDepthByRef[l.borehole_ref] = l.depth_to;
      }
    });
    const totalMeters = Object.values(maxDepthByRef).reduce((a, b) => a + b, 0);
    const boreholeCount = Object.keys(maxDepthByRef).length;
    const reviewRate = logs.length > 0 ? Math.round(((approved + queried) / logs.length) * 100) : 0;

    return { pending, approved, queried, withAnomalies, incomplete, agsImported, totalMeters, boreholeCount, reviewRate, total: logs.length };
  }, [logs]);

  // Jobs that have approved logs ready for OpenGround export
  const exportableJobs = useMemo(() => {
    const jobIdsWithApproved = new Set(logs.filter(l => l.manager_review_status === 'approved').map(l => l.job_id));
    return jobs.filter(j => jobIdsWithApproved.has(j.id));
  }, [logs, jobs]);

  const handleReview = async (status) => {
    if (!selectedLog) return;
    setReviewing(true);
    try {
      const me = await base44.auth.me();
      const finalNote = queryReason && queryReason !== 'Other (see note)'
        ? `${queryReason}${reviewNote ? ' — ' + reviewNote : ''}`
        : reviewNote;
      await base44.entities.InvestigationLog.update(selectedLog.id, {
        manager_review_status: status,
        manager_review_note: finalNote || '',
        manager_reviewed_by: me?.full_name || me?.email || 'Manager',
        manager_reviewed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
      toast({ title: status === 'approved' ? 'Log approved' : 'Log queried', duration: 2000 });
      setSelectedLog(null);
      setReviewNote('');
      setQueryReason('');
    } catch (e) {
      toast({ title: 'Error reviewing log', variant: 'destructive' });
    }
    setReviewing(false);
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setReviewing(true);
    try {
      const me = await base44.auth.me();
      const updates = [...selected].map(id => ({
        id,
        manager_review_status: 'approved',
        manager_review_note: 'Bulk approved (no issues found)',
        manager_reviewed_by: me?.full_name || me?.email || 'Manager',
        manager_reviewed_at: new Date().toISOString(),
      }));
      await base44.entities.InvestigationLog.bulkUpdate(updates);
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
      toast({ title: `${selected.size} log${selected.size !== 1 ? 's' : ''} approved` });
      setSelected(new Set());
      setBulkMode(false);
    } catch (e) {
      toast({ title: 'Error during bulk approval', variant: 'destructive' });
    }
    setReviewing(false);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAllVisible = () => {
    if (selected.size === filteredLogs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const handlePush = async () => {
    if (exportJobId === 'all') return;
    setPushing(true);
    setPushResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { job_id: exportJobId });
      const d = res.data || res;
      setPushResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Push complete',
        logs: d.logs_pushed || 0,
        boreholes: d.boreholes || 0,
        importId: d.import_id || '',
      });
      if (d.ok) toast({ title: `${d.logs_pushed} logs pushed to OpenGround`, duration: 3000 });
    } catch (e) {
      const d = e.response?.data || e;
      setPushResult({ ok: false, msg: d.error || d.message || e.message || 'Push failed' });
    }
    setPushing(false);
  };

  const handleExport = async () => {
    if (exportJobId === 'all') return;
    setExporting(true);
    try {
      const job = jobMap[exportJobId];
      const fileName = `${(job?.name || exportJobId).replace(/[^a-zA-Z0-9-_]/g, '_')}_OpenGround_${new Date().toISOString().slice(0, 10)}.ags`;
      const response = await base44.functions.invoke('generateJobAGSExport', { job_id: exportJobId });
      // response is an Axios response — data is in response.data
      const text = typeof response.data === 'string' ? response.data : await response.data?.text();
      if (!text) throw new Error('Empty export');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AGS file downloaded for OpenGround', duration: 3000 });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Export failed', variant: 'destructive' });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={ShieldCheck} title="Log Quality Control" description="Review all field & KeyLogBook data, approve it, then export to OpenGround for the Senior Engineer" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="text-amber-700 bg-amber-50 border-amber-200" onClick={() => setFilter('pending')} active={filter === 'pending'} />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="text-emerald-700 bg-emerald-50 border-emerald-200" onClick={() => setFilter('approved')} active={filter === 'approved'} />
        <StatCard label="Queried" value={stats.queried} icon={XCircle} color="text-red-700 bg-red-50 border-red-200" onClick={() => setFilter('queried')} active={filter === 'queried'} />
        <StatCard label="KeyLogBook" value={stats.agsImported} icon={Tablet} color="text-indigo-700 bg-indigo-50 border-indigo-200" onClick={() => setOriginFilter(originFilter === 'ags_import' ? 'all' : 'ags_import')} active={originFilter === 'ags_import'} />
        <StatCard label="Incomplete" value={stats.incomplete} icon={AlertTriangle} color="text-orange-700 bg-orange-50 border-orange-200" />
        <StatCard label="Anomalies" value={stats.withAnomalies} icon={AlertTriangle} color="text-rose-700 bg-rose-50 border-rose-200" onClick={() => setAnomalyOnly(!anomalyOnly)} active={anomalyOnly} />
        <StatCard label="Total Drilled" value={`${stats.totalMeters}m`} icon={ArrowDownToLine} color="text-blue-700 bg-blue-50 border-blue-200" />
      </div>

      {/* Review progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Review Progress</h3>
              <p className="text-xs text-slate-500">{stats.approved + stats.queried} of {stats.total} logs reviewed · {stats.boreholeCount} boreholes · {stats.totalMeters}m drilled</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">{stats.reviewRate}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${stats.total ? (stats.approved / stats.total) * 100 : 0}%` }} title={`${stats.approved} approved`} />
          <div className="bg-red-400 h-full transition-all" style={{ width: `${stats.total ? (stats.queried / stats.total) * 100 : 0}%` }} title={`${stats.queried} queried`} />
          <div className="bg-amber-400 h-full transition-all" style={{ width: `${stats.total ? (stats.pending / stats.total) * 100 : 0}%` }} title={`${stats.pending} pending`} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {stats.approved} approved</span>
          <span className="inline-flex items-center gap-1 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> {stats.queried} queried</span>
          <span className="inline-flex items-center gap-1 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {stats.pending} pending</span>
        </div>
      </div>

      {/* OpenGround Export bar */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Export to OpenGround</h3>
              <p className="text-xs text-slate-500">Download a complete AGS file of all <span className="font-semibold text-indigo-700">approved</span> logs for a job — includes review comments for the Senior Engineer.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select value={exportJobId} onChange={e => setExportJobId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white max-w-[200px] focus:outline-none focus:border-indigo-600">
              <option value="all">Select a job…</option>
              {exportableJobs.map(j => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
            <button onClick={handleExport} disabled={exportJobId === 'all' || exporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Building…' : 'Export AGS'}
            </button>
            <button onClick={handlePush} disabled={exportJobId === 'all' || pushing || !opengroundConnected}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {pushing ? 'Pushing…' : 'Push to OpenGround'}
            </button>
          </div>
        </div>
        {exportableJobs.length === 0 && (
          <p className="text-xs text-amber-700 mt-2">No jobs have approved logs yet. Approve logs below to enable export.</p>
        )}
        {!opengroundConnected && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <UploadCloud className="w-3.5 h-3.5" />
            OpenGround not configured — enter your API credentials in Settings → OpenGround Sync to enable direct push.
          </p>
        )}
        {pushResult && (
          <div className={`mt-3 rounded-lg px-3 py-2.5 text-xs ${pushResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <p className="flex items-start gap-2">
              {pushResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{pushResult.msg}</span>
            </p>
            {pushResult.ok && pushResult.logs > 0 && (
              <div className="flex gap-4 mt-2 pl-6">
                <span><span className="font-bold tabular-nums">{pushResult.logs}</span> logs pushed</span>
                <span><span className="font-bold tabular-nums">{pushResult.boreholes}</span> boreholes</span>
                {pushResult.importId && <span className="font-mono text-[10px]">ID: {pushResult.importId}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { key: 'pending', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'queried', label: 'Queried' },
            { key: 'all', label: 'All' },
          ].map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${filter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400">
          <option value="all">All sources</option>
          <option value="staff">Field staff</option>
          <option value="ags_import">KeyLogBook (AGS)</option>
        </select>
        <select value={crewFilter} onChange={e => setCrewFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400">
          <option value="all">All crews</option>
          <option value="internal">Internal</option>
          <option value="enabling">Enabling</option>
          <option value="subcontractor">Subcontractor</option>
        </select>
        <select value={jobFilter} onChange={e => setJobFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 max-w-[180px]">
          <option value="all">All jobs</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ref, sample, staff…"
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 w-44"
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400">
          <option value="date">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="borehole">Borehole ref</option>
          <option value="depth">Deepest first</option>
        </select>
        {anomalyOnly && (
          <button onClick={() => setAnomalyOnly(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 transition">
            <AlertTriangle className="w-3.5 h-3.5" /> Anomalies only ✕
          </button>
        )}
        <button onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${bulkMode ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <Filter className="w-3.5 h-3.5" /> {bulkMode ? 'Exit bulk' : 'Bulk approve'}
        </button>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <button onClick={selectAllVisible} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">
            {selected.size === filteredLogs.length ? 'Deselect all' : 'Select all visible'}
          </button>
          <span className="text-xs text-slate-600">{selected.size} selected</span>
          <button onClick={handleBulkApprove} disabled={selected.size === 0 || reviewing}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Approve {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      )}

      {/* Log list */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Loading logs…</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          No {filter !== 'all' ? filter : ''} logs to review.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => {
            const job = log.job_id ? jobMap[log.job_id] : null;
            const missing = getMissingFields(log);
            const anomalies = getAnomalyFlags(log);
            const reviewStatus = log.manager_review_status || 'pending';
            const rc = reviewStatusConfig[reviewStatus];
            const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
            const isAgs = log.source === 'ags_import';
            const isSelected = selected.has(log.id);
            return (
              <div key={log.id} className={`bg-white border rounded-xl p-3 hover:shadow-sm transition ${isSelected ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  {bulkMode && (
                    <button onClick={() => toggleSelect(log.id)} className="mt-1 flex-shrink-0">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  )}
                  <div className={`w-1.5 h-full min-h-[3rem] rounded-full ${rc.dot} flex-shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
                      {isAgs && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Tablet className="w-2.5 h-2.5" /> KeyLogBook
                        </span>
                      )}
                      {log.crew_type === 'enabling' && (
                        <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Undo2 className="w-2.5 h-2.5" /> Enabling
                        </span>
                      )}
                      {log.crew_type === 'subcontractor' && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <HardHat className="w-2.5 h-2.5" /> Sub-con
                        </span>
                      )}
                      <LogTypeBadge logType={log.log_type} />
                      {log.borehole_ref && <span className="text-xs font-mono font-bold text-slate-700">{log.borehole_ref}</span>}
                      {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
                      {job && <span className="text-xs text-slate-500 truncate">{job.name}</span>}
                      <span className="text-xs text-slate-400 ml-auto">{format(new Date(log.date + 'T00:00:00'), 'dd MMM')}</span>
                    </div>

                    {/* Key data summary */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {log.depth_from != null && log.depth_to != null && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Ruler className="w-2.5 h-2.5" /> {log.depth_from}→{log.depth_to}m
                        </span>
                      )}
                      {log.spt_n_value != null && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Calculator className="w-2.5 h-2.5" /> N={log.spt_n_value}
                        </span>
                      )}
                      {log.strata_descriptor && log.strata_descriptor !== 'other' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${strataConfig[log.strata_descriptor]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {strataConfig[log.strata_descriptor]?.label || log.strata_descriptor}
                        </span>
                      )}
                      {log.groundwater_strike_depth != null && (
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" /> {fmt(log.groundwater_strike_depth)}m
                        </span>
                      )}
                      {log.coring_recovery != null && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" /> {fmt(log.coring_recovery)}%
                        </span>
                      )}
                      {log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${pitStabilityConfig[log.pit_stability_rating]?.badge || 'bg-slate-100'}`}>
                          {pitStabilityConfig[log.pit_stability_rating]?.label || log.pit_stability_rating}
                        </span>
                      )}
                      {log.service_encounter_type && log.service_encounter_type !== 'none' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${serviceEncounterConfig[log.service_encounter_type]?.color || 'bg-slate-100'}`}>
                          <Waves className="w-2.5 h-2.5" /> {serviceEncounterConfig[log.service_encounter_type]?.label || log.service_encounter_type}
                        </span>
                      )}
                      {log.cbr_value != null && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Gauge className="w-2.5 h-2.5" /> CBR {fmt(log.cbr_value)}%
                        </span>
                      )}
                      {photos.length > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Camera className="w-2.5 h-2.5" /> {photos.length}
                        </span>
                      )}
                    </div>

                    {/* Warnings */}
                    {(missing.length > 0 || anomalies.length > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {missing.map((m, i) => (
                          <span key={`m${i}`} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Missing: {m}
                          </span>
                        ))}
                        {anomalies.map((a, i) => (
                          <span key={`a${i}`} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description + staff */}
                    <div className="mt-1.5 flex items-center gap-2">
                      {log.strata_description_detail && <p className="text-xs text-slate-600 truncate">{log.strata_description_detail}</p>}
                      {log.description && <p className="text-xs text-slate-500 truncate">{log.description}</p>}
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0 inline-flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />{log.staff_name || (isAgs ? 'KeyLogBook' : '—')}
                      </span>
                    </div>

                    {/* Review note preview */}
                    {log.manager_review_note && (
                      <div className="mt-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-slate-600">
                        <span className="font-medium">{log.manager_reviewed_by}:</span> {log.manager_review_note}
                      </div>
                    )}

                    {/* Action button */}
                    {!bulkMode && (
                      <button onClick={() => { setSelectedLog(log); setReviewNote(log.manager_review_note || ''); setQueryReason(''); }}
                        className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {selectedLog.source === 'ags_import' && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                    <Tablet className="w-3 h-3" /> KeyLogBook
                  </span>
                )}
                <h3 className="font-bold text-slate-900">Review Log Entry</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 text-sm">Close</button>
            </div>
            <div className="p-5 space-y-4">
              <LogDetailBlock log={selectedLog} />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Query Reason (optional)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {queryReasons.map(r => (
                    <button key={r} onClick={() => setQueryReason(r)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${queryReason === r ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Review Note</label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2}
                  placeholder="Add a note for the crew (optional)…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview('approved')} disabled={reviewing}
                  className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleReview('queried')} disabled={reviewing}
                  className="flex-1 px-4 py-2.5 bg-red-700 text-white rounded-xl font-semibold text-sm hover:bg-red-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Query / Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, onClick, active }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left p-3 rounded-xl border transition ${color} ${active ? 'ring-2 ring-offset-1 ring-slate-300' : ''} ${onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </button>
  );
}

function LogTypeBadge({ logType }) {
  const config = {
    borehole_progress: { label: 'Borehole', icon: ArrowDownToLine, badge: 'bg-blue-100 text-blue-700' },
    sample_collection: { label: 'Sample', icon: TestTube, badge: 'bg-purple-100 text-purple-700' },
    pit_excavation: { label: 'Trial Pit', icon: MapPin, badge: 'bg-amber-100 text-amber-700' },
    installation: { label: 'Installation', icon: Package, badge: 'bg-emerald-100 text-emerald-700' },
    site_setup: { label: 'Setup', icon: Wrench, badge: 'bg-slate-100 text-slate-600' },
    reinstatement: { label: 'Reinstatement', icon: Undo2, badge: 'bg-teal-100 text-teal-700' },
    standpipe_reading: { label: 'Standpipe', icon: Gauge, badge: 'bg-cyan-100 text-cyan-700' },
    core_inspection: { label: 'Core', icon: Layers, badge: 'bg-fuchsia-100 text-fuchsia-700' },
    other: { label: 'Other', icon: FileText, badge: 'bg-slate-100 text-slate-600' },
  };
  const c = config[logType] || config.other;
  const Icon = c.icon;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${c.badge}`}>
      <Icon className="w-2.5 h-2.5" /> {c.label}
    </span>
  );
}

function LogDetailBlock({ log }) {
  const photos = (log.photo_urls || '').split(',').filter(Boolean);
  const verificationPhotos = (log.verification_photo_urls || '').split(',').filter(Boolean);
  const allPhotos = [...photos, ...verificationPhotos];

  const fields = [
    { label: 'Borehole / Pit Ref', value: log.borehole_ref },
    { label: 'Depth', value: log.depth_from != null && log.depth_to != null ? `${log.depth_from}m → ${log.depth_to}m` : null },
    { label: 'Sample ID', value: log.sample_id },
    { label: 'Sample Type', value: log.sample_type && log.sample_type !== 'none' ? log.sample_type : null },
    { label: 'Strata', value: log.strata_descriptor && log.strata_descriptor !== 'other' ? strataConfig[log.strata_descriptor]?.label : null },
    { label: 'Strata Detail', value: log.strata_description_detail },
    { label: 'SPT N-value', value: log.spt_n_value },
    { label: 'SPT Blows', value: log.spt_blows?.length ? log.spt_blows.join(' / ') : null },
    { label: 'Water Strike', value: log.groundwater_strike_depth != null ? `${log.groundwater_strike_depth}m` : null },
    { label: 'Static Water Level', value: log.groundwater_static_level != null ? `${log.groundwater_static_level}m` : null },
    { label: 'Core Run', value: log.core_run_number },
    { label: 'Core Box', value: log.core_box_number },
    { label: 'Core Recovery', value: log.coring_recovery != null ? `${log.coring_recovery}%` : null },
    { label: 'RQD', value: log.coring_rqd != null ? `${log.coring_rqd}%` : null },
    { label: 'Dimensions', value: log.dimensions },
    { label: 'Pit Stability', value: log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' ? pitStabilityConfig[log.pit_stability_rating]?.label : null },
    { label: 'Service Encountered', value: log.service_encounter_type && log.service_encounter_type !== 'none' ? serviceEncounterConfig[log.service_encounter_type]?.label : null },
    { label: 'Service GPS', value: log.service_encounter_gps },
    { label: 'CBR', value: log.cbr_value != null ? `${log.cbr_value}%` : null },
    { label: 'Vane Strength', value: log.vane_strength != null ? `${log.vane_strength} kPa` : null },
    { label: 'Reinstatement', value: log.reinstatement_type && log.reinstatement_type !== 'none' ? log.reinstatement_type.replace(/_/g, ' ') : null },
    { label: 'Backfill', value: log.backfill_material },
    { label: 'Description', value: log.description },
    { label: 'Staff', value: log.staff_name || (log.source === 'ags_import' ? 'KeyLogBook import' : null) },
    { label: 'Reviewed By', value: log.manager_reviewed_by },
    { label: 'Review Date', value: log.manager_reviewed_at ? format(new Date(log.manager_reviewed_at), 'dd MMM yyyy HH:mm') : null },
  ].filter(f => f.value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-400 font-medium">{f.label}</p>
            <p className="text-sm text-slate-800 font-medium">{f.value}</p>
          </div>
        ))}
      </div>
      {log.manager_review_note && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Existing Review Note</p>
          <p className="text-sm text-amber-900">{log.manager_review_note}</p>
        </div>
      )}
      {allPhotos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Photos ({allPhotos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {allPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}