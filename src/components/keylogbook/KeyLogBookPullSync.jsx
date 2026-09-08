import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  DownloadCloud, CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock,
  KeyRound, Link2, Settings2, Eye, EyeOff, Save,
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-600 bg-white';

/**
 * Pull Sync panel for KeyLogBook — fetches all historical data from the
 * KeyLogBook REST API (projects, boreholes, driller remarks) and keeps it
 * in sync on a 30-minute schedule. Complements the real-time webhook.
 *
 * Also includes the "API Details" section (base URL, API key, custom endpoint
 * paths) so admins can configure the pull sync credentials and override the
 * inferred endpoint paths when KeyLogBook's API shape differs from defaults.
 */
export default function KeyLogBookPullSync({ config }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [savingCreds, setSavingCreds] = useState(false);

  // API credential state
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Custom endpoint state
  const [projectsPath, setProjectsPath] = useState('');
  const [boreholesPath, setBoreholesPath] = useState('');
  const [remarksPath, setRemarksPath] = useState('');

  useEffect(() => {
    if (config) {
      setApiBaseUrl(config.api_base_url || '');
      setApiKey(config.api_key || '');
      const ce = config.custom_endpoints || {};
      setProjectsPath(ce.projects_path || '');
      setBoreholesPath(ce.boreholes_path || '');
      setRemarksPath(ce.remarks_path || '');
    }
  }, [config]);

  const handleSaveCreds = async () => {
    setSavingCreds(true);
    try {
      const payload = {
        api_base_url: apiBaseUrl.trim(),
        api_key: apiKey.trim(),
        custom_endpoints: {
          projects_path: projectsPath.trim(),
          boreholes_path: boreholesPath.trim(),
          remarks_path: remarksPath.trim(),
        },
      };
      if (config?.id) {
        await base44.entities.KeyLogBookConfig.update(config.id, payload);
      } else {
        await base44.entities.KeyLogBookConfig.create({ key: 'global', ...payload });
      }
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
      toast({ title: 'API details saved', description: 'Pull sync credentials updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSavingCreds(false);
  };

  const handlePull = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncKeyLogBook');
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult({ ok: true, summary: data.summary, counts: data });
      toast({ title: 'KeyLogBook pull complete', description: data.summary });
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast({ title: 'Pull sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
    }
  };

  const lastStatus = config?.last_pull_sync_status || 'never';
  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Last pull: Success' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Last pull: Failed' },
    never: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No pull sync yet' },
  };
  const StatusIcon = statusConfig[lastStatus].icon;
  const hasCredentials = !!config?.api_base_url && !!config?.api_key;

  return (
    <div className="space-y-4">
      {/* === API Details Section === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">API Details</h3>
            <p className="text-xs text-slate-500">Credentials and endpoint paths for the KeyLogBook REST API pull sync.</p>
          </div>
        </div>

        {/* API Base URL */}
        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Link2 className="w-3.5 h-3.5 text-slate-400" /> API base URL
          </label>
          <input type="text" value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
            placeholder="https://api.keylogbook.com/v1"
            className={inputCls} />
        </div>

        {/* API Key */}
        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <KeyRound className="w-3.5 h-3.5 text-slate-400" /> API key (Bearer token)
          </label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your KeyLogBook API key"
              className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded">
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Custom Endpoint Paths (collapsible) */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Custom endpoint paths (optional)</p>
          </div>
          <p className="text-[11px] text-slate-500 -mt-1">
            Override the default inferred paths if KeyLogBook's API differs. Use <code className="text-slate-600 bg-slate-200 px-1 rounded">{'{projectId}'}</code> as a placeholder in the borehole/remark paths. Leave blank to use defaults.
          </p>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Projects path</label>
              <input type="text" value={projectsPath} onChange={e => setProjectsPath(e.target.value)}
                placeholder="/projects"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-600 bg-white" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Boreholes path</label>
              <input type="text" value={boreholesPath} onChange={e => setBoreholesPath(e.target.value)}
                placeholder="/projects/{projectId}/boreholes"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-600 bg-white" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Remarks path</label>
              <input type="text" value={remarksPath} onChange={e => setRemarksPath(e.target.value)}
                placeholder="/projects/{projectId}/remarks"
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-600 bg-white" />
            </div>
          </div>
        </div>

        {/* Save credentials button */}
        <button onClick={handleSaveCreds} disabled={savingCreds}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {savingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingCreds ? 'Saving…' : 'Save API Details'}
        </button>
      </div>

      {/* === Pull Sync Status & Button === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DownloadCloud className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Pull Sync</h3>
            <p className="text-xs text-slate-500">Fetch all projects, boreholes, and remarks from the KeyLogBook API.</p>
          </div>
        </div>

        {/* Status panel */}
        {config?.last_pull_sync_at && (
          <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
            <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{statusConfig[lastStatus].label}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(config.last_pull_sync_at).toLocaleString('en-GB')}
              </p>
              {config.last_pull_sync_summary && (
                <p className="text-xs text-slate-600 mt-1">{config.last_pull_sync_summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Pull button */}
        <button
          onClick={handlePull}
          disabled={syncing || !hasCredentials}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Pulling from KeyLogBook…
            </>
          ) : (
            <>
              <DownloadCloud className="w-4 h-4" />
              Pull All from KeyLogBook
            </>
          )}
        </button>

        {/* Missing credentials warning */}
        {!hasCredentials && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Enter the KeyLogBook API base URL and API key in the "API Details" section above, then save before pulling.</span>
          </div>
        )}

        {/* Result panel */}
        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} animate-slide-up`}>
            {result.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${result.ok ? 'text-emerald-900' : 'text-red-900'}`}>
                {result.ok ? 'Pull sync complete' : 'Pull sync failed'}
              </p>
              <p className={`text-xs mt-1 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.ok ? result.summary : result.error}
              </p>
            </div>
          </div>
        )}

        {/* Help text */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Also runs automatically every 30 minutes. New data pushed via webhook appears instantly.
          </span>
        </div>
      </div>
    </div>
  );
}