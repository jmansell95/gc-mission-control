import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Download, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Briefcase, Layers, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SCOPES = [
  { key: 'job', label: 'Whole Job', icon: Briefcase },
  { key: 'borehole', label: 'One Borehole', icon: Layers },
  { key: 'staff', label: 'One Staff', icon: User },
];

/**
 * Simplified export modal — replaces the inline export bar with its scope
 * toggle + multiple selectors. One clean modal: pick a job, optionally
 * narrow to a borehole or staff member, then download AGS or push to
 * OpenGround.
 */
export default function InvestigationExportModal({ open, onClose, logs = [], jobs = [], staff = [] }) {
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
    setOpengroundConnected(!!(opengroundSettings?.[0]?.value?.client_id && opengroundSettings?.[0]?.value?.client_secret));
  }, [opengroundSettings]);

  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => m[j.id] = j); return m; }, [jobs]);
  const staffMap = useMemo(() => { const m = {}; staff.forEach(s => m[s.id] = s); return m; }, [staff]);

  const exportableJobs = useMemo(() => {
    const ids = new Set(logs.filter(l => l.manager_review_status === 'approved').map(l => l.job_id));
    return jobs.filter(j => ids.has(j.id));
  }, [logs, jobs]);

  const boreholesInJob = useMemo(() => {
    if (jobId === 'all') return [];
    return [...new Set(logs.filter(l => l.job_id === jobId && l.manager_review_status === 'approved' && l.borehole_ref).map(l => l.borehole_ref))].sort();
  }, [logs, jobId]);

  const staffInJob = useMemo(() => {
    if (jobId === 'all') return [];
    const ids = [...new Set(logs.filter(l => l.job_id === jobId && l.manager_review_status === 'approved' && l.staff_id).map(l => l.staff_id))];
    return staff.filter(s => ids.includes(s.id));
  }, [logs, jobId, staff]);

  const canExport = scope === 'job' ? jobId !== 'all'
    : scope === 'borehole' ? (jobId !== 'all' && boreholeRef !== 'all')
    : (jobId !== 'all' && staffId !== 'all');

  if (!open) return null;

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
      a.href = url; a.download = buildFileName(); a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AGS file downloaded', duration: 3000 });
      onClose();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Export failed', variant: 'destructive' });
    }
    setExporting(false);
  };

  const handlePush = async () => {
    if (jobId === 'all') return;
    setPushing(true); setPushResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { job_id: jobId });
      const d = res.data || res;
      setPushResult({ ok: !!d.ok, msg: d.message || d.error || 'Push complete', logs: d.logs_pushed || 0, boreholes: d.boreholes || 0, importId: d.import_id || '' });
      if (d.ok) toast({ title: `${d.logs_pushed} logs pushed to OpenGround`, duration: 3000 });
    } catch (e) {
      const d = e.response?.data || e;
      setPushResult({ ok: false, msg: d.error || d.message || e.message || 'Push failed' });
    }
    setPushing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-pop-in">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">Export to OpenGround</h2>
            <p className="text-xs text-slate-500">Download approved logs as AGS or push directly.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mb-3">
          {SCOPES.map(s => {
            const Icon = s.icon;
            const active = scope === s.key;
            return (
              <button key={s.key} onClick={() => { setScope(s.key); setBoreholeRef('all'); setStaffId('all'); }}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Icon className="w-3.5 h-3.5" /> {s.label}
              </button>
            );
          })}
        </div>

        {/* Job selector */}
        <label className="text-xs font-semibold text-slate-700 mb-1 block">Job</label>
        <select value={jobId} onChange={e => { setJobId(e.target.value); setBoreholeRef('all'); setStaffId('all'); }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-3 focus:outline-none focus:border-indigo-600">
          <option value="all">Select a job…</option>
          {exportableJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>

        {/* Conditional selectors */}
        {scope === 'borehole' && (
          <>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Borehole</label>
            <select value={boreholeRef} onChange={e => setBoreholeRef(e.target.value)} disabled={jobId === 'all'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-3 disabled:opacity-50 focus:outline-none focus:border-indigo-600">
              <option value="all">Select borehole…</option>
              {boreholesInJob.map(ref => <option key={ref} value={ref}>{ref}</option>)}
            </select>
          </>
        )}
        {scope === 'staff' && (
          <>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Staff Member</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} disabled={jobId === 'all'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-3 disabled:opacity-50 focus:outline-none focus:border-indigo-600">
              <option value="all">Select staff…</option>
              {staffInJob.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>
        )}

        {exportableJobs.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">No jobs have approved logs yet. Approve logs first to enable export.</p>
        )}

        {/* Push result */}
        {pushResult && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${pushResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <p className="flex items-start gap-2">
              {pushResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{pushResult.msg}</span>
            </p>
            {pushResult.ok && pushResult.logs > 0 && (
              <div className="flex gap-4 mt-1.5 pl-6">
                <span><span className="font-bold tabular-nums">{pushResult.logs}</span> logs</span>
                <span><span className="font-bold tabular-nums">{pushResult.boreholes}</span> boreholes</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!canExport || exporting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Building…' : 'Download AGS'}
          </button>
          {scope === 'job' && (
            <button onClick={handlePush} disabled={jobId === 'all' || pushing || !opengroundConnected}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {pushing ? 'Pushing…' : 'Push to OpenGround'}
            </button>
          )}
        </div>
        {!opengroundConnected && scope === 'job' && (
          <p className="text-[11px] text-slate-500 mt-2 text-center">OpenGround not configured — Settings → OpenGround Sync to enable push.</p>
        )}
      </div>
    </div>
  );
}