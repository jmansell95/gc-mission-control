import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Loader2, Save, Check, AlertTriangle, RefreshCw, Lock,
  ArrowDownToLine, ArrowUpFromLine, Link2, Link2Off, Settings2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  api_url: '',
  client_id: '',
  client_secret: '',
  token_url: '',
  company_uuid: '',
  auto_sync_enabled: true,
  sync_frequency: 'weekly',
  lock_after_sync: true,
  default_gl_currency: 'GBP',
};

/**
 * ConcurSyncSettings — the SAP Concur integration hub.
 * Lets admins configure the API bridge: connection status, GL code pull,
 * batch export of approved expenses/timesheets, and record locking.
 */
export default function ConcurSyncSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState(null);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconResult(null);
    try {
      const res = await base44.functions.invoke('importConcurReconciliation', { action: 'reconcile' });
      const d = res.data || {};
      setReconResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Reconciliation complete',
        checked: d.checked || 0,
        reconciled: d.reconciled || 0,
        missing: d.missing_in_concur || 0,
        errors: d.errors || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['daily-costs-synced-concur'] });
    } catch (e) {
      setReconResult({ ok: false, msg: e.message || 'Reconciliation failed' });
    }
    setReconciling(false);
  };

  // Load saved config from AppSetting on mount
  const { data: settingsRec, isLoading: loadingSettings } = useQuery({
    queryKey: ['concur-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'concur_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec && settingsRec.length > 0 && settingsRec[0].value) {
      setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
    }
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;

  const { data: pendingCosts = [] } = useQuery({
    queryKey: ['daily-costs-pending-concur'],
    queryFn: () => base44.entities.DailyCost.filter({ status: 'approved' }, '-created_date', 500),
  });
  const { data: pendingSubcons = [] } = useQuery({
    queryKey: ['subcon-logs-pending-concur'],
    queryFn: () => base44.entities.SubcontractorLog.filter({ status: 'approved' }, '-created_date', 500),
  });

  const pendingCount = pendingCosts.length + pendingSubcons.length;
  const syncedCosts = useQuery({
    queryKey: ['daily-costs-synced-concur'],
    queryFn: () => base44.entities.DailyCost.filter({ status: 'synced_to_concur' }, '-synced_at', 50),
  });

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'concur_config', label: 'SAP Concur Sync Configuration', value: config };
      if (configId) {
        await base44.entities.AppSetting.update(configId, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['concur-config'] });
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
      const res = await base44.functions.invoke('syncConcurExpenses', { action: 'test' });
      setTestResult({ ok: !!res.data?.ok, msg: res.data?.message || res.data?.error || 'Unknown response' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res = await base44.functions.invoke('syncConcurExpenses', { action: 'export' });
      const d = res.data || {};
      setExportResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Export complete',
        exported: d.exported || 0,
        errors: d.errors || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['daily-costs-pending-concur'] });
      queryClient.invalidateQueries({ queryKey: ['subcon-logs-pending-concur'] });
      queryClient.invalidateQueries({ queryKey: ['daily-costs-synced-concur'] });
    } catch (e) {
      setExportResult({ ok: false, msg: e.message || 'Export failed', exported: 0, errors: 1 });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Landmark}
        title="SAP Concur Sync"
        description="API bridge to SAP Concur — pull GL codes, push approved expenses & timesheets in batch, and lock synced records to prevent audit mismatches."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${config.client_id ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.client_id ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {config.client_id ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{config.client_id ? 'Connected' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{config.client_id ? 'SAP Concur API bridge active — records can be synced.' : 'Enter your SAP Concur API credentials below to enable the bridge.'}</p>
          </div>
          <button onClick={handleTest} disabled={testing}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="url" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://us.api.concursolutions.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Token URL</label>
            <input type="url" value={config.token_url} onChange={e => setConfig({ ...config, token_url: e.target.value })}
              placeholder="https://us.api.concursolutions.com/oauth2/v0" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
            <input type="text" value={config.client_id} onChange={e => setConfig({ ...config, client_id: e.target.value })}
              placeholder="your-concur-client-id" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
            <input type="password" value={config.client_secret} onChange={e => setConfig({ ...config, client_secret: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company UUID</label>
            <input type="text" value={config.company_uuid} onChange={e => setConfig({ ...config, company_uuid: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Currency</label>
            <select value={config.default_gl_currency} onChange={e => setConfig({ ...config, default_gl_currency: e.target.value })} className={inputCls}>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
              <p className="text-[11px] text-slate-400">Push approved records automatically on schedule</p>
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
        <label className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
          <input type="checkbox" checked={config.lock_after_sync} onChange={e => setConfig({ ...config, lock_after_sync: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Lock records after sync</p>
            <p className="text-[11px] text-slate-500">Hard-locks expenses & timesheets once exported to SAP, preventing audit mismatches</p>
          </div>
        </label>
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
          <span className="ml-auto text-xs text-slate-400">{pendingCount} approved record{pendingCount !== 1 ? 's' : ''} pending</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium uppercase">Daily Expenses</p>
            <p className="text-xl font-bold text-blue-700 tabular-nums">{pendingCosts.length}</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-violet-600 font-medium uppercase">Sub-Con Logs</p>
            <p className="text-xl font-bold text-violet-700 tabular-nums">{pendingSubcons.length}</p>
          </div>
        </div>
        <button onClick={handleExport} disabled={!config.client_id || pendingCount === 0 || exporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />} Export Batch to SAP Concur ({pendingCount})
        </button>
        {!config.client_id && <p className="text-[11px] text-amber-600 mt-2 text-center">Connect your API credentials first to enable batch export.</p>}
        {exportResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${exportResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>{exportResult.msg}</p>
          </div>
        )}
      </div>

      {/* Reverse sync — reconcile exports back from Concur */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownToLine className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Reverse Sync (Reconciliation)</h3>
          <span className="ml-auto text-xs text-slate-400">Pull report IDs & GL updates back from Concur</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Verifies each exported record landed in Concur, captures the Concur report ID and approval status, and pulls back any GL code Concur reassigned. Traces each expense to its Concur report.</p>
        <button onClick={handleReconcile} disabled={!config.client_id || reconciling}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition">
          {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />} Reconcile from SAP Concur
        </button>
        {!config.client_id && <p className="text-[11px] text-amber-600 mt-2 text-center">Connect your API credentials first to enable reconciliation.</p>}
        {reconResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${reconResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {reconResult.msg}</p>
            {reconResult.ok && reconResult.checked > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Checked</p><p className="font-bold text-slate-700 tabular-nums">{reconResult.checked}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Reconciled</p><p className="font-bold text-emerald-700 tabular-nums">{reconResult.reconciled}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Missing</p><p className="font-bold text-amber-700 tabular-nums">{reconResult.missing}</p></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recently synced */}
      {syncedCosts.data && syncedCosts.data.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Recently Synced</h3>
            <span className="ml-auto text-xs text-slate-400">{syncedCosts.data.length} records locked</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {syncedCosts.data.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 truncate flex-1">{c.description || c.category}</span>
                <span className="text-slate-400">{c.date}</span>
                <span className="text-slate-400 font-mono">{c.concur_export_id || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}