import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, ArrowDownToLine, ArrowUpFromLine, Webhook, Copy, Shield,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  api_url: 'https://api.hibob.com/v1',
  username: '',
  api_token: '',
  company_id: '',
  webhook_secret: '',
  auto_sync_enabled: true,
  sync_frequency: 'daily',
  pull_time_off: true,
  push_time_off: true,
  last_sync_at: null,
};

const WEBHOOK_RELATIVE = '/functions/bobWebhook';

/**
 * BobHRSettings — Bob HR (Hibob) integration hub.
 * Lets admins configure the API bridge: connection status, bidirectional
 * time-off sync, webhook receiver for real-time events.
 */
export default function BobHRSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Generate a random webhook secret on first load if empty
  const genSecret = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  // Load saved config from AppSetting on mount
  const { data: settingsRec, isLoading: loadingSettings } = useQuery({
    queryKey: ['bob-hr-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'bob_hr_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec && settingsRec.length > 0 && settingsRec[0].value) {
      setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
    }
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const webhookUrl = config.api_url ? '' : '';

  // Pending push count (approved manual absences not yet synced to Bob)
  const { data: pendingAbsences = [] } = useQuery({
    queryKey: ['absences-pending-bob'],
    queryFn: () => base44.entities.Absence.filter({ status: 'approved', source: 'manual', bob_status: 'pending' }, '-created_date', 200),
  });

  // Recently synced from Bob
  const { data: syncedFromBob = [] } = useQuery({
    queryKey: ['absences-from-bob'],
    queryFn: () => base44.entities.Absence.filter({ source: 'bob_hr' }, '-created_date', 20),
  });

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const staffByEmail = {};
  for (const s of staff) { if (s.email) staffByEmail[s.email.toLowerCase()] = s; }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const valueToSave = { ...config };
      if (!valueToSave.webhook_secret) valueToSave.webhook_secret = genSecret();
      const payload = { key: 'bob_hr_config', label: 'Bob HR Sync Configuration', value: valueToSave };
      if (configId) {
        await base44.entities.AppSetting.update(configId, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['bob-hr-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setTestResult({ ok: false, msg: `Failed to save: ${e.message || e}` });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('syncBobAbsences', { action: 'test' });
      setTestResult({ ok: !!res.data?.ok, msg: res.data?.message || res.data?.error || 'Unknown response' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncBobAbsences', { action: 'sync' });
      const d = res.data || {};
      setSyncResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Sync complete',
        pulled: d.pulled || 0,
        pushed: d.pushed || 0,
        errors: d.push_errors || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['absences-pending-bob'] });
      queryClient.invalidateQueries({ queryKey: ['absences-from-bob'] });
      queryClient.invalidateQueries({ queryKey: ['absences'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const copyWebhookUrl = () => {
    const fullUrl = buildWebhookUrl(WEBHOOK_RELATIVE);
    const secret = config.webhook_secret ? `?secret=${config.webhook_secret}` : '';
    navigator.clipboard.writeText(fullUrl + secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Users}
        title="Bob HR Sync"
        description="Bidirectional time-off bridge to Bob HR (Hibob) — pull approved leave from Bob into your rota, and push leave approved in this app back to Bob. Webhook receiver keeps absences live in real time."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${config.username ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.username ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {config.username ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{config.username ? 'Connected' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{config.username ? 'Bob HR API bridge active — time-off can be synced.' : 'Enter your Bob HR service credentials below to enable the bridge.'}</p>
            {config.last_sync_at && <p className="text-[11px] text-slate-400 mt-0.5">Last sync: {new Date(config.last_sync_at).toLocaleString('en-GB')}</p>}
          </div>
          <button onClick={handleTest} disabled={testing || !config.username}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>{testResult.msg}</p>
          </div>
        )}
      </div>

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">API Credentials</h3>
        </div>
        <p className="text-xs text-slate-500">Create a service account in Bob HR (Settings → Integrations → API) with "Time Off" read/write permissions. Use the service username and API token below.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="url" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://api.hibob.com/v1" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company ID <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={config.company_id} onChange={e => setConfig({ ...config, company_id: e.target.value })}
              placeholder="your-bob-company-id" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Service Username</label>
            <input type="text" value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })}
              placeholder="service-account@yourcompany.com" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Token</label>
            <input type="password" value={config.api_token} onChange={e => setConfig({ ...config, api_token: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Sync direction */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Sync Direction</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.pull_time_off} onChange={e => setConfig({ ...config, pull_time_off: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" /> Pull from Bob HR</p>
              <p className="text-[11px] text-slate-400">Fetch approved time-off requests from Bob HR and create absence records here (source: bob_hr)</p>
            </div>
          </label>
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.push_time_off} onChange={e => setConfig({ ...config, push_time_off: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" /> Push to Bob HR</p>
              <p className="text-[11px] text-slate-400">Send leave approved in this app back to Bob HR as new time-off requests</p>
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
              <p className="text-[11px] text-slate-400">Run bidirectional sync automatically on schedule</p>
            </div>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
            <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls} disabled={!config.auto_sync_enabled}>
              <option value="daily">Daily (every night)</option>
              <option value="weekly">Weekly (every Monday)</option>
              <option value="monthly">Monthly (1st of month)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Webhook configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Webhook Receiver</h3>
        </div>
        <p className="text-xs text-slate-500">Bob HR can push real-time time-off events to this endpoint. Configure the webhook in Bob HR (Settings → Integrations → Webhooks) using the URL below, and set the same secret in both places to verify authenticity.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook URL</label>
            <div className="flex items-center gap-2">
              <input readOnly value={buildWebhookUrl(WEBHOOK_RELATIVE)}
                className={`${inputCls} bg-slate-50 font-mono text-xs`} />
              <button onClick={copyWebhookUrl} className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Copy includes the secret query param for quick setup in Bob HR.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret</label>
            <div className="flex items-center gap-2">
              <input type="text" value={config.webhook_secret} onChange={e => setConfig({ ...config, webhook_secret: e.target.value })}
                placeholder="auto-generated on save" className={`${inputCls} font-mono text-xs`} />
              <button onClick={() => setConfig({ ...config, webhook_secret: genSecret() })}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
                <Shield className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Bob HR sends this secret in the <code className="font-mono bg-slate-100 px-1 rounded">X-Bob-Webhook-Secret</code> header. Must match exactly.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Sync queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Sync Queue</h3>
          <span className="ml-auto text-xs text-slate-400">{pendingAbsences.length} approved absence{pendingAbsences.length !== 1 ? 's' : ''} pending push to Bob HR</span>
        </div>
        <button onClick={handleSync} disabled={!config.username || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync Now (Pull & Push)
        </button>
        {!config.username && <p className="text-[11px] text-amber-600 mt-2 text-center">Connect your API credentials first to enable sync.</p>}
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
            {syncResult.ok && (syncResult.pulled > 0 || syncResult.pushed > 0) && (
              <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Pulled</p><p className="font-bold text-blue-700 tabular-nums">{syncResult.pulled}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Pushed</p><p className="font-bold text-emerald-700 tabular-nums">{syncResult.pushed}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recently synced from Bob */}
      {syncedFromBob.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownToLine className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Recently Pulled from Bob HR</h3>
            <span className="ml-auto text-xs text-slate-400">{syncedFromBob.length} records</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {syncedFromBob.slice(0, 10).map(a => {
              const member = staff.find(s => s.id === a.staff_id);
              return (
                <div key={a.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="text-slate-700 font-medium truncate flex-1">{member?.name || 'Unknown'}</span>
                  <span className="text-slate-400">{a.start_date} → {a.end_date}</span>
                  <span className="text-slate-400 font-mono">#{a.bob_request_id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}