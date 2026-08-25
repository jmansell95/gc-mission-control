import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Briefcase, Layers, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SCOPES = [
  { key: 'job', label: 'Per Job', icon: Briefcase },
  { key: 'borehole', label: 'Per Borehole', icon: Layers },
  { key: 'staff', label: 'Per Staff', icon: User },
];

/**
 * Multi-scope AGS export bar for the Investigation Hub.
 *  - Per Job: download AGS of all approved logs for a job, or push to OpenGround.
 *  - Per Borehole: download AGS for a single borehole within a job.
 *  - Per Staff: download AGS for a single staff member's logs within a job.
 *
 * All scopes use the generateJobAGSExport backend function, which accepts
 * optional borehole_ref / staff_id filters. Only approved logs are exported.
 */
export default function InvestigationExportBar({ logs = [], jobs = [], staff = [] }) {
  const { toast } = useToast();
  const [scope, setScope] = useState('job');
  const [jobId, setJobId] = useState('all');
  const [boreholeRef, setBoreholeRef] = useState('all');
  const [staffId, setStaffId] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  const { data: opengroundSettings } = useQuery({
    queryKey: ['openground-config-investigation'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'openground_config' }, '-created_date', 1),
  });
  const [opengroundConnected, setOpengroundConnected] = useState(false);
  useEffect(() => {
    const cfg = opengroundSettings?.[0]?.value;
    setOpengroundConnected(!!(cfg?.client_id && cfg?.client_secret));
  }, [opengroundSettings]);

  const jobMap = useMemo(() => {
    const m = {}; jobs.forEach(j => { m[j.id] = j; }); return m;
  }, [jobs]);
  const staffMap = useMemo(() => {
    const m = {}; staff.forEach(s => { m[s.id] = s; }); return m;
  }, [staff]);

  // Jobs that have at least one approved log
  const exportableJobs = useMemo(() => {
    const jobIdsWithApproved = new Set(logs.filter(l => l.manager_review_status === 'approved').map(l => l.job_id));
    return jobs.filter(j => jobIdsWithApproved.has(j.id));
  }, [logs, jobs]);

  // Borehole refs within the selected job (with approved logs)
  const boreholesInJob = useMemo(() => {
    if (jobId === 'all') return [];
    return [...new Set(logs
      .filter(l => l.job_id === jobId && l.manager_review_status === 'approved' && l.borehole_ref)
      .map(l => l.borehole_ref))].sort();
  }, [logs, jobId]);

  // Staff within the selected job (with approved logs)
  const staffInJob = useMemo(() => {
    if (jobId === 'all') return [];
    const ids = [...new Set(logs
      .filter(l => l.job_id === jobId && l.manager_review_status === 'approved' && l.staff_id)
      .map(l => l.staff_id))];
    return staff.filter(s => ids.includes(s.id));
  }, [logs, jobId, staff]);

  const canExport = scope === 'job'
    ? jobId !== 'all'
    : scope === 'borehole'
      ? (jobId !== 'all' && boreholeRef !== 'all')
      : (jobId !== 'all' && staffId !== 'all');

  const buildFileName = () => {
    const job = jobMap[jobId];
    const safe = (job?.name || jobId).replace(/[^a-zA-Z0-9-_]/g, '_');
    const tag = scope === 'borehole' ? `_BH-${boreholeRef}` : scope === 'staff' ? `_Staff-${(staffMap[staffId]?.name || staffId).replace(/\s+/g, '_')}` : '';
    return `${safe}${tag}_OpenGround_${new Date().toISOString().slice(0, 10)}.ags`;
  };

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const payload = { job_id: jobId };
      if (scope === 'borehole') payload.borehole_ref = boreholeRef;
      if (scope === 'staff') payload.staff_id = staffId;
      const response = await base44.functions.invoke('generateJobAGSExport', payload);
      const text = typeof response.data === 'string' ? response.data : await response.data?.text();
      if (!text) throw new Error('Empty export');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFileName();
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AGS file downloaded for OpenGround', duration: 3000 });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Export failed', variant: 'destructive' });
    }
    setExporting(false);
  };

  const handlePush = async () => {
    if (jobId === 'all') return;
    setPushing(true);
    setPushResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { job_id: jobId });
      const d = res.data || res;
      setPushResult({
        ok: !!d.ok, msg: d.message || d.error || 'Push complete',
        logs: d.logs_pushed || 0, boreholes: d.boreholes || 0, importId: d.import_id || '',
      });
      if (d.ok) toast({ title: `${d.logs_pushed} logs pushed to OpenGround`, duration: 3000 });
    } catch (e) {
      const d = e.response?.data || e;
      setPushResult({ ok: false, msg: d.error || d.message || e.message || 'Push failed' });
    }
    setPushing(false);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-3 mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Export to OpenGround</h3>
          <p className="text-xs text-slate-500">Download approved logs as an AGS file, or push directly to OpenGround.</p>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-1 bg-white/60 rounded-lg p-1 mb-2.5 w-full sm:w-auto sm:inline-flex">
        {SCOPES.map(s => {
          const Icon = s.icon;
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Target selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <select value={jobId} onChange={e => { setJobId(e.target.value); setBoreholeRef('all'); setStaffId('all'); }}
          className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white flex-1 sm:flex-none sm:w-auto focus:outline-none focus:border-indigo-600 min-w-0">
          <option value="all">Select a job…</option>
          {exportableJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>

        {scope === 'borehole' && (
          <select value={boreholeRef} onChange={e => setBoreholeRef(e.target.value)} disabled={jobId === 'all'}
            className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white flex-1 sm:flex-none sm:w-auto focus:outline-none focus:border-indigo-600 disabled:opacity-50 min-w-0">
            <option value="all">Select borehole…</option>
            {boreholesInJob.map(ref => <option key={ref} value={ref}>{ref}</option>)}
          </select>
        )}

        {scope === 'staff' && (
          <select value={staffId} onChange={e => setStaffId(e.target.value)} disabled={jobId === 'all'}
            className="px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white flex-1 sm:flex-none sm:w-auto focus:outline-none focus:border-indigo-600 disabled:opacity-50 min-w-0">
            <option value="all">Select staff…</option>
            {staffInJob.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <button onClick={handleExport} disabled={!canExport || exporting}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Building…' : 'Export AGS'}
        </button>

        {scope === 'job' && (
          <button onClick={handlePush} disabled={jobId === 'all' || pushing || !opengroundConnected}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            {pushing ? 'Pushing…' : 'Push to OpenGround'}
          </button>
        )}
      </div>

      {exportableJobs.length === 0 && (
        <p className="text-xs text-amber-700 mt-2">No jobs have approved logs yet. Approve logs to enable export.</p>
      )}
      {!opengroundConnected && scope === 'job' && (
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
          <UploadCloud className="w-3.5 h-3.5" />
          OpenGround not configured — enter API credentials in Settings → OpenGround Sync to enable direct push.
        </p>
      )}
      {pushResult && (
        <div className={`mt-2.5 rounded-lg px-3 py-2 text-xs ${pushResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <p className="flex items-start gap-2">
            {pushResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>{pushResult.msg}</span>
          </p>
          {pushResult.ok && pushResult.logs > 0 && (
            <div className="flex gap-4 mt-1.5 pl-6">
              <span><span className="font-bold tabular-nums">{pushResult.logs}</span> logs pushed</span>
              <span><span className="font-bold tabular-nums">{pushResult.boreholes}</span> boreholes</span>
              {pushResult.importId && <span className="font-mono text-[10px]">ID: {pushResult.importId}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}