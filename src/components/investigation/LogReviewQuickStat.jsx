import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, Tablet, Loader2, UploadCloud, ExternalLink, Mountain } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Quick-view stat card showing the review progress of investigation logs
// for a job. Shown on the job Summary tab so managers see QC status at a
// glance, with a one-click Push to OpenGround button + last sync indicator.
export default function LogReviewQuickStat({ job }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['job-log-review-stat', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  // Check if OpenGround is configured + get last sync info
  const { data: opengroundSettings } = useQuery({
    queryKey: ['openground-config-quickstat'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'openground_config' }, '-created_date', 1),
  });

  const opengroundCfg = opengroundSettings?.[0]?.value || {};
  const opengroundConnected = !!(opengroundCfg.client_id && opengroundCfg.client_secret);
  const lastSyncAt = opengroundCfg.last_sync_at;
  const lastSyncStatus = opengroundCfg.last_sync_status;
  const lastSyncSummary = opengroundCfg.last_sync_summary;

  const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const approved = logs.filter(l => l.manager_review_status === 'approved').length;
  const queried = logs.filter(l => l.manager_review_status === 'queried').length;
  const agsImported = logs.filter(l => l.source === 'ags_import').length;
  const total = logs.length;
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
  const boreholeCount = [...new Set(logs.filter(l => l.manager_review_status === 'approved' && l.borehole_ref).map(l => l.borehole_ref))].length;

  const handlePush = async () => {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { job_id: job.id });
      const d = res.data || res;
      setPushResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Push complete',
        logs: d.logs_pushed || 0,
        boreholes: d.boreholes || 0,
      });
      if (d.ok) toast({ title: `${d.logs_pushed} logs pushed to OpenGround`, duration: 3000 });
    } catch (e) {
      const d = e.response?.data || e;
      setPushResult({ ok: false, msg: d.error || d.message || e.message || 'Push failed' });
    }
    setPushing(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
        <div className="h-8 w-full bg-slate-100 rounded" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><ShieldCheck className="w-3.5 h-3.5 text-slate-400" /></div>
          <h3 className="font-semibold text-slate-900 text-sm">Log Review</h3>
        </div>
        <p className="text-xs text-slate-400">No site logs recorded yet.</p>
      </div>
    );
  }

  const statusColor = pct === 100 ? 'emerald' : pending > 0 ? 'amber' : 'slate';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusColor === 'emerald' ? 'bg-emerald-50' : statusColor === 'amber' ? 'bg-amber-50' : 'bg-slate-100'}`}>
          <ShieldCheck className={`w-3.5 h-3.5 ${statusColor === 'emerald' ? 'text-emerald-600' : statusColor === 'amber' ? 'text-amber-600' : 'text-slate-500'}`} />
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">Log Review</h3>
        {agsImported > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
            <Tablet className="w-2.5 h-2.5" /> {agsImported} KeyLogBook
          </span>
        )}
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{total} Logs</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${statusColor === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-bold ${statusColor === 'emerald' ? 'text-emerald-700' : 'text-amber-700'}`}>{pct}%</span>
      </div>

      {/* Breakdown chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" /> {approved} Approved
        </span>
        {pending > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> {pending} Pending
          </span>
        )}
        {queried > 0 && (
          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> {queried} Queried
          </span>
        )}
        {boreholeCount > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Mountain className="w-2.5 h-2.5" /> {boreholeCount} Boreholes
          </span>
        )}
      </div>

      {/* Push to OpenGround button — only enabled when there are approved logs */}
      <button onClick={handlePush} disabled={approved === 0 || pushing || !opengroundConnected}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
        {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
        {pushing ? 'Pushing…' : 'Push to OpenGround'}
      </button>

      {/* Push result feedback */}
      {pushResult && (
        <div className={`mt-2 rounded-lg px-2.5 py-2 text-[11px] ${pushResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <p className="flex items-start gap-1.5">
            {pushResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
            <span>{pushResult.msg}</span>
          </p>
          {pushResult.ok && pushResult.logs > 0 && (
            <div className="flex gap-3 mt-1 pl-5">
              <span><span className="font-bold tabular-nums">{pushResult.logs}</span> logs</span>
              <span><span className="font-bold tabular-nums">{pushResult.boreholes}</span> boreholes</span>
            </div>
          )}
        </div>
      )}

      {/* Status messages */}
      {approved === 0 && (
        <p className="text-[11px] text-slate-400 mt-1.5 text-center">Approve logs in Log QC to enable push</p>
      )}
      {!opengroundConnected && approved > 0 && (
        <p className="text-[11px] text-amber-600 mt-1.5 text-center">OpenGround not configured — Settings → OpenGround Sync</p>
      )}

      {/* Last sync indicator */}
      {lastSyncAt && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`w-1.5 h-1.5 rounded-full ${lastSyncStatus === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>Last push: {new Date(lastSyncAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(lastSyncAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* Quick link to Log QC */}
      <button onClick={() => navigate('/compliance')}
        className="mt-2 w-full inline-flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-primary font-medium transition">
        Review logs in Log QC <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}