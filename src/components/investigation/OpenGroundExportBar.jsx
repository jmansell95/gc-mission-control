import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Download, UploadCloud, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Compact OpenGround export bar — lets the manager download an AGS file of
 * all approved logs for a job, or push directly to OpenGround if configured.
 * Extracted from LogQualityControl so the Investigation Hub can own log review
 * without a separate duplicate tab.
 */
export default function OpenGroundExportBar({ logs = [], jobs = [] }) {
  const { toast } = useToast();
  const [exportJobId, setExportJobId] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [opengroundConnected, setOpengroundConnected] = useState(false);

  const { data: opengroundSettings } = useQuery({
    queryKey: ['openground-config-investigation'],
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

  const exportableJobs = useMemo(() => {
    const jobIdsWithApproved = new Set(logs.filter(l => l.manager_review_status === 'approved').map(l => l.job_id));
    return jobs.filter(j => jobIdsWithApproved.has(j.id));
  }, [logs, jobs]);

  const handleExport = async () => {
    if (exportJobId === 'all') return;
    setExporting(true);
    try {
      const job = jobMap[exportJobId];
      const fileName = `${(job?.name || exportJobId).replace(/[^a-zA-Z0-9-_]/g, '_')}_OpenGround_${new Date().toISOString().slice(0, 10)}.ags`;
      const response = await base44.functions.invoke('generateJobAGSExport', { job_id: exportJobId });
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

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-3 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Export to OpenGround</h3>
            <p className="text-xs text-slate-500">Download or push all <span className="font-semibold text-indigo-700">approved</span> logs for a job as an AGS file.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select value={exportJobId} onChange={e => setExportJobId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white max-w-[180px] focus:outline-none focus:border-indigo-600">
            <option value="all">Select a job…</option>
            {exportableJobs.map(j => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
          <button onClick={handleExport} disabled={exportJobId === 'all' || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Building…' : 'Export AGS'}
          </button>
          <button onClick={handlePush} disabled={exportJobId === 'all' || pushing || !opengroundConnected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            {pushing ? 'Pushing…' : 'Push'}
          </button>
        </div>
      </div>
      {exportableJobs.length === 0 && (
        <p className="text-xs text-amber-700 mt-2">No jobs have approved logs yet. Approve logs to enable export.</p>
      )}
      {!opengroundConnected && (
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