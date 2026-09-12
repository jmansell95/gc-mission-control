import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Route,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  api_key: '',
  geocoding_enabled: true,
  route_optimisation_enabled: false,
  last_sync_at: null,
};

export default function GoogleMapsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['google-maps-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'google_maps_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const connected = !!config.api_key;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'google_maps_config', label: 'Google Maps API Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['google-maps-config'] });
      queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${config.api_key}`;
      const res = await fetch(testUrl);
      const data = await res.json();
      if (data.status === 'OK') {
        setTestResult({ ok: true, msg: 'Connection successful — Google Maps API key is valid.' });
      } else {
        setTestResult({ ok: false, msg: `API returned: ${data.status} — ${data.error_message || 'check your API key'}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={MapPin}
        title="Google Maps Platform"
        description="Connect Google Maps Platform for job site geocoding (converting addresses to lat/lng coordinates) and delivery route optimisation. The geocoding button on the job form uses this key. Get an API key from the Google Cloud Console — enable the Geocoding API and Routes API."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Google Maps API key saved — geocoding is active.' : 'Enter your Google Maps API key below.'}</p>
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
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">API Credentials</h3>
        </div>
        <p className="text-xs text-slate-500">Create a project in the <code className="bg-slate-100 px-1 rounded">Google Cloud Console</code>, enable the Geocoding API and (optionally) the Routes API, then create an API key. Restrict the key to your domain for security.</p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Google Maps API Key</label>
          <input type="password" value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
            placeholder="AIzaSy..." className={`${inputCls} font-mono`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.geocoding_enabled} onChange={e => setConfig({ ...config, geocoding_enabled: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-600" /> Geocoding</p>
              <p className="text-[11px] text-slate-400">Convert job site addresses to GPS coordinates for geofencing</p>
            </div>
          </label>
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.route_optimisation_enabled} onChange={e => setConfig({ ...config, route_optimisation_enabled: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Route className="w-3.5 h-3.5 text-blue-600" /> Route Optimisation</p>
              <p className="text-[11px] text-slate-400">Optimise delivery routes and crew travel times</p>
            </div>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>
    </div>
  );
}