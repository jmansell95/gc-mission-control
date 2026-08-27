import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Satellite, Clock, CalendarDays,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import GeofenceSettings from '@/components/settings/GeofenceSettings';
import { useDivisionAppSetting } from '@/hooks/useDivisionAppSetting';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const DEFAULT_CONFIG = {
  server: 'my.geotab.com',
  username: '',
  password: '',
  database: '',
  auto_sync_enabled: false,
  sync_frequency: '5min',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function GeotabSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [tsDate, setTsDate] = useState(new Date().toISOString().slice(0, 10));
  const [tsSyncing, setTsSyncing] = useState(false);
  const [tsResult, setTsResult] = useState(null);

  const { config, setConfig, save, activeDivisionId } = useDivisionAppSetting('geotab_config', { label: 'Geotab GPS Sync Configuration', defaultValue: DEFAULT_CONFIG });
  const connected = !!(config.username && config.password && config.database);

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
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'test', division_id: activeDivisionId });
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
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'sync', division_id: activeDivisionId });
      const d = res.data || res;
      setSyncResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Sync complete',
        synced: d.synced || 0,
        unmatched: d.unmatched || 0,
        total: d.total_statuses || 0,
        created: d.vehicles_created || 0,
        updated: d.vehicles_updated || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['app-setting', 'geotab_config'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-location-logs'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleTsSync = async () => {
    setTsSyncing(true);
    setTsResult(null);
    try {
      const res = await base44.functions.invoke('syncGeotabTimesheets', { date: tsDate, division_id: activeDivisionId });
      const d = res.data || res;
      setTsResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Sync complete',
        synced: d.synced || 0,
        skipped: d.skipped || 0,
        date: d.date || tsDate,
        results: d.results || [],
      });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    } catch (e) {
      setTsResult({ ok: false, msg: e.message || 'Timesheet sync failed' });
    }
    setTsSyncing(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Satellite}
        title="Geotab GPS Sync"
        description="Connect Geotab to auto-import your entire fleet — vehicle details (make, model, VIN, year, fuel type) and live GPS locations are pulled automatically. New vehicles in Geotab are created here on sync; existing ones are enriched with full spec data. Powers the live map and fleet cards on the Vehicles page. If your server is wrong, the system auto-discovers the correct one on first sync."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Geotab API credentials saved — test the connection or sync now.' : 'Enter your Geotab API credentials below to enable live fleet tracking.'}</p>
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
          <h3 className="text-sm font-bold text-slate-800">Geotab API Credentials</h3>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-blue-800">How to get these credentials:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            <li>Log in to your <a href="https://my.geotab.com" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">Geotab MyAdmin portal</a></li>
            <li>Go to <span className="font-medium">System Settings → Users</span> and create an API user (or use an existing one)</li>
            <li>The <span className="font-medium">Database</span> is your company name in Geotab (case-sensitive — check it under <span className="font-medium">Administration → Database</span>)</li>
            <li>The <span className="font-medium">Server</span> is the URL in your browser address bar when logged in (e.g. <code className="bg-slate-100 px-1 rounded">my.geotab.com</code>, <code className="bg-slate-100 px-1 rounded">my3.geotab.com</code>, <code className="bg-slate-100 px-1 rounded">my4.geotab.com</code>)</li>
            <li>The <span className="font-medium">Username</span> is typically an email address</li>
          </ol>
          <p className="pt-1">Full API docs: <a href="https://developers.geotab.com/myGeotab/apiReference/methods/Authenticate/" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">Geotab API Reference</a></p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Geotab Server</label>
            <input type="text" value={config.server} onChange={e => setConfig({ ...config, server: e.target.value })}
              placeholder="my.geotab.com" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">The server from your Geotab login URL. Wrong server = login fails.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Database / Company Name</label>
            <input type="text" value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })}
              placeholder="Your Geotab database name" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">Case-sensitive — must match exactly as shown in Geotab.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input type="text" value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })}
              placeholder="your@email.com" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">Usually an email address. Create an API user in Geotab MyAdmin.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input type="password" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">The API user's password (not your main account password unless they're the same).</p>
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
            <p className="text-[11px] text-slate-400">Pull live locations from Geotab on a schedule</p>
          </div>
        </label>
        {config.auto_sync_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
            <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls}>
              <option value="5min">Every 5 minutes</option>
              <option value="15min">Every 15 minutes</option>
              <option value="30min">Every 30 minutes</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily (every night)</option>
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

      {/* Manual sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Pull Live Locations Now</h3>
          <span className="ml-auto text-xs text-slate-400">Fetch current GPS positions from all vehicles</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Fetches the current location, speed, ignition status and odometer for every vehicle in your Geotab account and stores them as location logs. Vehicles are matched to your local records by registration number. View the results on the Vehicles page → Live Map.</p>
        <button onClick={handleSync} disabled={!connected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />} Sync Locations Now
        </button>
        {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center">Save your Geotab credentials first to enable location sync.</p>}
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
            {syncResult.ok && syncResult.total > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Locations</p><p className="font-bold text-emerald-700 tabular-nums">{syncResult.synced}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Created</p><p className="font-bold text-cyan-700 tabular-nums">{syncResult.created}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Updated</p><p className="font-bold text-blue-700 tabular-nums">{syncResult.updated}</p></div>
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

      {/* Timesheet auto-generation from GPS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Auto-Generate Timesheets from GPS</h3>
          <span className="ml-auto text-xs text-slate-400">Geofence-based arrival/departure detection</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Reads the GPS location logs for the selected date, matches each driver to their rota assignment, detects arrival and departure at the job site (within 200m geofence), and creates draft <span className="font-medium">travel-to / on-site / travel-home</span> timesheet entries. Jobs need site coordinates set (use the geocode button on the job form) for geofencing to work.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Date to process</label>
            <div className="relative">
              <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="date" value={tsDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setTsDate(e.target.value)} className={`${inputCls} pl-9`} />
            </div>
          </div>
          <button onClick={handleTsSync} disabled={!connected || tsSyncing || !tsDate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition whitespace-nowrap">
            {tsSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Generate Timesheets
          </button>
        </div>
        {!connected && <p className="text-[11px] text-amber-600 mb-2">Save your Geotab credentials and sync locations first.</p>}
        {tsResult && (
          <div className={`rounded-lg px-3 py-2 text-xs ${tsResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {tsResult.msg}</p>
            {tsResult.ok && (
              <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Entries Created</p><p className="font-bold text-emerald-700 tabular-nums">{tsResult.synced}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Skipped</p><p className="font-bold text-slate-600 tabular-nums">{tsResult.skipped}</p></div>
              </div>
            )}
            {tsResult.ok && tsResult.results?.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {tsResult.results.slice(0, 8).map((r, i) => (
                  <div key={i} className="text-[11px] bg-white/50 rounded px-2 py-1 flex items-center gap-2">
                    <span className="font-medium text-slate-700 truncate flex-1">{r.staff}</span>
                    <span className="text-slate-400 truncate hidden sm:inline">{r.job}</span>
                    <span className="text-slate-500 tabular-nums whitespace-nowrap">{r.arrival} → {r.departure}</span>
                  </div>
                ))}
                {tsResult.results.length > 8 && <p className="text-[10px] text-slate-400 text-center pt-1">+{tsResult.results.length - 8} more</p>}
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-2">A nightly automation also runs this automatically for yesterday's shifts — entries appear as drafts for crew review.</p>
      </div>

      {/* Geofence Detection — arrival/departure alerts for job sites & supplier yards */}
      <GeofenceSettings />
    </div>
  );
}