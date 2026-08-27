import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Webhook, Copy, Shield, Fuel,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import { useDivisionAppSetting } from '@/hooks/useDivisionAppSetting';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const DEFAULT_CONFIG = {
  api_url: 'https://api.holman.com',
  api_key: '',
  client_id: '',
  client_secret: '',
  account_id: '',
  webhook_secret: '',
  sync_enabled: true,
  auto_sync_enabled: false,
  sync_frequency: 'daily',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
  last_webhook_at: null,
  last_webhook_status: null,
  last_webhook_summary: '',
};

const WEBHOOK_RELATIVE = '/functions/holmanWebhook';

/**
 * HolmanSettings — Holman Fleet Management integration hub.
 * Lets admins configure API credentials, webhook receiver, and
 * sync fleet vehicle data (MOT, service dates, mileage) into
 * the local Vehicle records.
 */
export default function HolmanSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [fuelSyncing, setFuelSyncing] = useState(false);
  const [fuelSyncResult, setFuelSyncResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const genSecret = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  const { config, setConfig, save, activeDivisionId } = useDivisionAppSetting('holman_config', { label: 'Holman Fleet Sync Configuration', defaultValue: DEFAULT_CONFIG });

  // Build the full webhook URL from the current origin
  const webhookUrl = buildWebhookUrl(WEBHOOK_RELATIVE);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const ok = await save();
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      toast({ title: 'Save failed', description: 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'test', division_id: activeDivisionId });
      const d = res.data || res;
      setTestResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown response' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'sync', division_id: activeDivisionId });
      const d = res.data || res;
      setSyncResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Sync complete',
        synced: d.synced || 0,
        unmatched: d.unmatched || 0,
        total: d.total || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['app-setting', 'holman_config'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleSyncFuel = async () => {
    setFuelSyncing(true);
    setFuelSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'sync_fuel', division_id: activeDivisionId });
      const d = res.data || res;
      setFuelSyncResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Fuel sync complete',
        imported: d.imported || 0,
        jobMatched: d.jobMatched || 0,
        jobUnmatched: d.jobUnmatched || 0,
        duplicate: d.duplicate || 0,
        unmatched: d.unmatched || 0,
        total: d.total || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['app-setting', 'holman_config'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-maintenance-bookings'] });
    } catch (e) {
      setFuelSyncResult({ ok: false, msg: e.message || 'Fuel sync failed' });
    }
    setFuelSyncing(false);
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connected = !!(config.api_key || config.client_id);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Truck}
        title="Holman Fleet Sync"
        description="Holman manages fleet compliance and maintenance — MOTs, scheduled services, windscreen repairs, breakdowns, and fuel cards. Connect Holman to automatically sync these dates and events into your vehicle records. For live GPS tracking, use Geotab GPS Sync instead."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Holman API credentials saved — test the connection or sync now.' : 'Enter your Holman API credentials below to enable fleet sync.'}</p>
          </div>
          <button onClick={handleTest} disabled={testing || !connected}
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
          <Settings2 className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">API Credentials</h3>
        </div>

        {/* How to get Holman API access */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-blue-800">How to get Holman API access:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            <li>Contact your <span className="font-medium">Holman account manager</span> and request API access for your fleet account. Holman does not publish self-service API keys — access is provisioned per customer.</li>
            <li>Ask for the <span className="font-medium">API Base URL</span> (Holman will provide the correct endpoint for your region/account, e.g. <code className="bg-slate-100 px-1 rounded">https://api.holmanfleet.com</code> or a custom URL).</li>
            <li>Request an <span className="font-medium">API Key</span> (a long alphanumeric token). This is your primary authentication credential.</li>
            <li>If your Holman account uses <span className="font-medium">OAuth 2.0</span> instead of an API key, ask for a <span className="font-medium">Client ID</span> and <span className="font-medium">Client Secret</span> pair.</li>
            <li>Ask for your <span className="font-medium">Account / Company ID</span> — Holman uses this to scope API calls to your specific fleet.</li>
            <li>Request that Holman enable <span className="font-medium">webhook events</span> for your account (MOT expiry, service due, odometer updates, breakdown status, fuel card alerts). Give them the webhook URL below.</li>
          </ol>
          <p className="pt-1.5 border-t border-blue-100 mt-2">Holman API docs (provided after access is granted): <a href="https://www.holman.co.uk/fleet-management" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">Holman Fleet Management</a> · Phone: <span className="font-medium">+44 (0)1582 470 600</span></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="url" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://api.holman.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Account / Company ID <span className="text-slate-400">(if required)</span></label>
            <input type="text" value={config.account_id} onChange={e => setConfig({ ...config, account_id: e.target.value })}
              placeholder="Holman account ID" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
            <input type="password" value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              placeholder="your-holman-api-key" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client ID <span className="text-slate-400">(OAuth, if applicable)</span></label>
            <input type="text" value={config.client_id} onChange={e => setConfig({ ...config, client_id: e.target.value })}
              placeholder="holman-client-id" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret <span className="text-slate-400">(OAuth, if applicable)</span></label>
            <input type="password" value={config.client_secret} onChange={e => setConfig({ ...config, client_secret: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.sync_enabled} onChange={e => setConfig({ ...config, sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700">Enable webhook receiver</p>
              <p className="text-[11px] text-slate-400">Accept incoming fleet events from Holman</p>
            </div>
          </label>
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
              <p className="text-[11px] text-slate-400">Pull fleet data on a schedule</p>
            </div>
          </label>
        </div>
        {config.auto_sync_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
            <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls}>
              <option value="daily">Daily (every night)</option>
              <option value="weekly">Weekly (every Monday)</option>
              <option value="monthly">Monthly (1st of month)</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Webhook receiver */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Webhook Receiver</h3>
        </div>
        <p className="text-xs text-slate-500">Add this URL to your Holman portal's webhook configuration to receive real-time fleet events (MOT expiry, service due, odometer updates). Holman will push updates here automatically.</p>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={webhookUrl} className={`${inputCls} bg-slate-50 font-mono text-xs`} />
          <button onClick={handleCopyWebhook} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret</label>
            <div className="flex gap-2">
              <input type="text" value={config.webhook_secret} onChange={e => setConfig({ ...config, webhook_secret: e.target.value })}
                placeholder="Shared secret for authenticating Holman webhooks" className={`${inputCls} font-mono`} />
              <button onClick={() => setConfig({ ...config, webhook_secret: genSecret() })}
                className="flex items-center gap-1 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
                <Shield className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Append as <code className="bg-slate-100 px-1 rounded">?webhook_secret=...</code> to the webhook URL, or send in the <code className="bg-slate-100 px-1 rounded">x-webhook-secret</code> header.</p>
          </div>
        </div>
        {(config.last_webhook_at || config.last_webhook_status) && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last webhook event</p>
            <p className="text-xs text-slate-500">{config.last_webhook_summary || 'No summary'}</p>
            {config.last_webhook_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_webhook_at).toLocaleString('en-GB')}</p>}
          </div>
        )}
      </div>

      {/* Manual sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Manual Fleet Sync</h3>
          <span className="ml-auto text-xs text-slate-400">Pull all vehicles from Holman now</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Fetches the full fleet vehicle list from Holman and updates MOT expiry, service due dates, last service dates, breakdown status, windscreen repair logs, and fuel card alerts on matching local Vehicle records. Vehicles are matched by registration number, Holman fleet ID, or VIN.</p>
        <button onClick={handleSync} disabled={!connected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync Fleet Now
        </button>
        {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center">Save your API credentials first to enable fleet sync.</p>}
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
            {syncResult.ok && syncResult.total > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Total</p><p className="font-bold text-slate-700 tabular-nums">{syncResult.total}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Synced</p><p className="font-bold text-emerald-700 tabular-nums">{syncResult.synced}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Unmatched</p><p className="font-bold text-amber-700 tabular-nums">{syncResult.unmatched}</p></div>
              </div>
            )}
          </div>
        )}
        {(config.last_sync_at || config.last_sync_status) && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
            <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
            {config.last_sync_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>}
          </div>
        )}
      </div>

      {/* Fuel card sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fuel className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Fuel Card Transactions</h3>
          <span className="ml-auto text-xs text-slate-400">Pull fuel card spend from Holman</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Fetches fuel card transactions from Holman and creates fuel card booking records for each transaction, matched to vehicles by registration or VIN. Each transaction is also matched to the job the vehicle was assigned to on that date (via the rota) and recorded as a fuel cost against that job for profitability tracking. Transactions are deduplicated by reference number, and vehicle mileage is updated from odometer readings on the fuel receipt.</p>
        <button onClick={handleSyncFuel} disabled={!connected || fuelSyncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          {fuelSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fuel className="w-4 h-4" />} Sync Fuel Cards
        </button>
        {fuelSyncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${fuelSyncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {fuelSyncResult.msg}</p>
            {fuelSyncResult.ok && fuelSyncResult.total > 0 && (
              <div className="grid grid-cols-5 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Total</p><p className="font-bold text-slate-700 tabular-nums">{fuelSyncResult.total}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Imported</p><p className="font-bold text-emerald-700 tabular-nums">{fuelSyncResult.imported}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Job Matched</p><p className="font-bold text-blue-700 tabular-nums">{fuelSyncResult.jobMatched || 0}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">No Job</p><p className="font-bold text-amber-700 tabular-nums">{fuelSyncResult.jobUnmatched || 0}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Unmatched</p><p className="font-bold text-rose-700 tabular-nums">{fuelSyncResult.unmatched}</p></div>
              </div>
            )}
          </div>
        )}
        {config.last_fuel_sync_at && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last fuel sync</p>
            <p className="text-xs text-slate-500">{config.last_fuel_sync_summary || 'No summary'}</p>
            <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_fuel_sync_at).toLocaleString('en-GB')}</p>
          </div>
        )}
      </div>
    </div>
  );
}