import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Webhook, Copy, Shield, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  provider: '', // 'xero' | 'sage' | ''
  // Xero
  xero_client_id: '',
  xero_client_secret: '',
  xero_tenant_id: '',
  xero_webhook_secret: '',
  // Sage
  sage_client_id: '',
  sage_client_secret: '',
  sage_tenant_id: '',
  // Common
  auto_sync_enabled: false,
  sync_frequency: 'daily',
  push_invoices: true,
  push_purchase_costs: true,
  pull_supplier_bills: false,
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

const WEBHOOK_RELATIVE = '/functions/accountingWebhook';

export default function AccountingSyncSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const genSecret = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  const { data: settingsRec } = useQuery({
    queryKey: ['accounting-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'accounting_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const webhookUrl = buildWebhookUrl(WEBHOOK_RELATIVE);
  const connected = config.provider === 'xero'
    ? !!(config.xero_client_id && config.xero_client_secret)
    : config.provider === 'sage'
    ? !!(config.sage_client_id && config.sage_client_secret)
    : false;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'accounting_config', label: 'Accounting Sync Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['accounting-config'] });
      queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncAccounting', { action: 'sync' });
      const d = res.data || res;
      setSyncResult({ ok: !!d.ok, msg: d.message || d.error || 'Sync complete', pushed: d.pushed || 0, pulled: d.pulled || 0 });
      queryClient.invalidateQueries({ queryKey: ['accounting-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={FileSpreadsheet}
        title="Accounting Sync (Xero / Sage)"
        description="Push invoices and purchase costs directly to your accounting software — Xero or Sage 50. Eliminates double-entry by syncing approved invoices and subcontractor costs automatically. Choose your provider and enter OAuth credentials below."
      />

      {/* Provider selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Select Accounting Provider</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => setConfig({ ...config, provider: 'xero' })}
            className={`p-4 rounded-xl border-2 text-left transition ${config.provider === 'xero' ? 'border-primary bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-slate-800">Xero</p>
            </div>
            <p className="text-[11px] text-slate-400">Cloud accounting — OAuth 2.0 integration with automatic invoice pushing</p>
          </button>
          <button onClick={() => setConfig({ ...config, provider: 'sage' })}
            className={`p-4 rounded-xl border-2 text-left transition ${config.provider === 'sage' ? 'border-primary bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-slate-800">Sage 50</p>
            </div>
            <p className="text-[11px] text-slate-400">Desktop & cloud — OAuth 2.0 integration with invoice and cost pushing</p>
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? `${config.provider === 'xero' ? 'Xero' : 'Sage'} Configured` : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Credentials saved — ready to sync invoices and costs.' : `Enter your ${config.provider === 'xero' ? 'Xero' : 'Sage'} OAuth credentials below.`}</p>
          </div>
        </div>
      </div>

      {/* Credentials — Xero */}
      {config.provider === 'xero' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Xero OAuth Credentials</h3>
          </div>
          <p className="text-xs text-slate-500">Create a custom app in the <code className="bg-slate-100 px-1 rounded">Xero Developer Portal</code> with the "accounting.transactions" and "accounting.contacts" scopes. Add the client ID and secret, then connect your tenant.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
              <input type="text" value={config.xero_client_id} onChange={e => setConfig({ ...config, xero_client_id: e.target.value })}
                placeholder="Your Xero app client ID" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
              <input type="password" value={config.xero_client_secret} onChange={e => setConfig({ ...config, xero_client_secret: e.target.value })}
                placeholder="••••••••••••" className={`${inputCls} font-mono`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tenant ID <span className="text-slate-400 font-normal">(auto-populated after OAuth)</span></label>
              <input type="text" value={config.xero_tenant_id} onChange={e => setConfig({ ...config, xero_tenant_id: e.target.value })}
                placeholder="Xero organisation/tenant ID" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </div>
      )}

      {/* Credentials — Sage */}
      {config.provider === 'sage' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Sage OAuth Credentials</h3>
          </div>
          <p className="text-xs text-slate-500">Create an app in the <code className="bg-slate-100 px-1 rounded">Sage Developer Portal</code> with the "full_access" scope. Use the client ID and secret to authenticate, then connect your business.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
              <input type="text" value={config.sage_client_id} onChange={e => setConfig({ ...config, sage_client_id: e.target.value })}
                placeholder="Your Sage app client ID" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
              <input type="password" value={config.sage_client_secret} onChange={e => setConfig({ ...config, sage_client_secret: e.target.value })}
                placeholder="••••••••••••" className={`${inputCls} font-mono`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tenant / Business ID <span className="text-slate-400 font-normal">(auto-populated after OAuth)</span></label>
              <input type="text" value={config.sage_tenant_id} onChange={e => setConfig({ ...config, sage_tenant_id: e.target.value })}
                placeholder="Sage business ID" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </div>
      )}

      {/* Sync direction */}
      {config.provider && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Sync Direction</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={config.push_invoices} onChange={e => setConfig({ ...config, push_invoices: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
              <div>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" /> Push Invoices</p>
                <p className="text-[11px] text-slate-400">Send raised invoices to {config.provider === 'xero' ? 'Xero' : 'Sage'} as draft sales invoices</p>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={config.push_purchase_costs} onChange={e => setConfig({ ...config, push_purchase_costs: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
              <div>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" /> Push Purchase Costs</p>
                <p className="text-[11px] text-slate-400">Send subcontractor & material costs as draft purchase bills</p>
              </div>
            </label>
            <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={config.pull_supplier_bills} onChange={e => setConfig({ ...config, pull_supplier_bills: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
              <div>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" /> Pull Supplier Bills</p>
                <p className="text-[11px] text-slate-400">Fetch supplier bills from {config.provider === 'xero' ? 'Xero' : 'Sage'} for reconciliation</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
                <p className="text-[11px] text-slate-400">Run sync automatically on schedule</p>
              </div>
            </label>
          </div>
          {config.auto_sync_enabled && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
              <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily (every night)</option>
                <option value="weekly">Weekly (every Monday)</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
            </button>
            {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
          </div>
        </div>
      )}

      {/* Webhook receiver */}
      {config.provider && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Webhook Receiver</h3>
          </div>
          <p className="text-xs text-slate-500">{config.provider === 'xero' ? 'Xero' : 'Sage'} can push real-time invoice status updates to this endpoint. Configure the webhook in your {config.provider === 'xero' ? 'Xero' : 'Sage'} developer portal.</p>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={webhookUrl} className={`${inputCls} bg-slate-50 font-mono text-xs`} />
            <button onClick={handleCopyWebhook} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex-shrink-0">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret (Xero)</label>
            <div className="flex gap-2">
              <input type="text" value={config.xero_webhook_secret} onChange={e => setConfig({ ...config, xero_webhook_secret: e.target.value })}
                placeholder="Xero webhook intent verification key" className={`${inputCls} font-mono`} />
              <button onClick={() => setConfig({ ...config, xero_webhook_secret: genSecret() })}
                className="flex items-center gap-1 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
                <Shield className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual sync */}
      {config.provider && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Sync Now</h3>
          </div>
          <button onClick={handleSync} disabled={!connected || syncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync to {config.provider === 'xero' ? 'Xero' : 'Sage'} Now
          </button>
          {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center">Save your credentials first to enable sync.</p>}
          {syncResult && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
            </div>
          )}
          {config.last_sync_at && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
              <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
              <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}