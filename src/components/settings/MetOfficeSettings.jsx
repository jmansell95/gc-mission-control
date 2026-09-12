import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud, Loader2, Check, AlertTriangle, RefreshCw, Link2, Download, Globe,
  Key, Eye, EyeOff, Save, ExternalLink,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import WeatherThresholdsSettings from '@/components/settings/WeatherThresholdsSettings';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_CONFIG = {
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function MetOfficeSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const { data: settingsRec } = useQuery({
    queryKey: ['met-office-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'met_office_config' }, '-created_date', 5),
  });

  const { data: apiKeyRec } = useQuery({
    queryKey: ['weather-api-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'weather_api_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  useEffect(() => {
    if (apiKeyRec?.[0]?.value?.api_key) setApiKey(apiKeyRec[0].value.api_key);
  }, [apiKeyRec]);

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const existing = apiKeyRec?.[0];
      const value = { api_key: apiKey.trim() };
      if (existing) {
        await base44.entities.AppSetting.update(existing.id, { value });
      } else {
        await base44.entities.AppSetting.create({ key: 'weather_api_config', label: 'WeatherAPI.com Key', value });
      }
      queryClient.invalidateQueries({ queryKey: ['weather-api-config'] });
      toast({ title: 'API key saved', description: 'Weather sync will now use WeatherAPI.com.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSavingKey(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncMetOfficeWeather', {});
      const d = res.data || res;
      setSyncResult({ ok: !!d.ok, msg: d.message || d.error || 'Sync complete', synced: d.synced || 0, errors: d.errors || 0 });
      queryClient.invalidateQueries({ queryKey: ['met-office-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const key = apiKey.trim();
      if (!key) {
        setTestResult({ ok: false, msg: 'Enter your WeatherAPI.com key first, then save.' });
        setTesting(false);
        return;
      }
      const res = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${key}&q=51.5,-0.1&days=1&aqi=no&alerts=no`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.current) {
        setTestResult({ ok: true, msg: `Connection successful — WeatherAPI.com is live. Current London: ${data.current.temp_c}°C, ${data.current.condition?.text || '—'}` });
      } else {
        setTestResult({ ok: false, msg: data?.error?.message || `API returned ${res.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const hasKey = !!apiKeyRec?.[0]?.value?.api_key;

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Cloud}
        title="Weather API"
        description="WeatherAPI.com (recommended) provides reliable, API-key-based forecasts that aren't affected by shared-IP rate limiting. Falls back to free Open-Meteo when no key is set."
      />

      <WeatherThresholdsSettings />

      {/* API Key Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">WeatherAPI.com API Key</h3>
          {hasKey && (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" /> Connected
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Sign up free at{' '}
          <a href="https://www.weatherapi.com/signup.aspx" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline inline-flex items-center gap-0.5">
            weatherapi.com <ExternalLink className="w-3 h-3" />
          </a>
          {' '}— the free tier allows 1 million calls/month. Paste your key below to enable reliable weather syncs.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your WeatherAPI.com key"
              className="w-full pr-10 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            disabled={savingKey || !apiKey.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition whitespace-nowrap"
          >
            {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Key
          </button>
        </div>
        <button onClick={handleTest} disabled={testing || !apiKey.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
        </button>
        {testResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>{testResult.msg}</p>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">About the Weather API</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">No Shared-IP Throttling</p>
              <p className="text-slate-500 mt-0.5">API-key auth means your traffic isn't blocked by other apps sharing the server IP.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">UK-Accurate Forecasts</p>
              <p className="text-slate-500 mt-0.5">High-resolution UK model data with daily forecasts and current conditions.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">All Business Streams Covered</p>
              <p className="text-slate-500 mt-0.5">Every active job site across every division gets weather data.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">Drilling-Specific Alerts</p>
              <p className="text-slate-500 mt-0.5">Auto-flags stop-work and caution conditions for drilling crews.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Sync Now</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">Pulls today's weather forecast for all active job sites and stores it as a WeatherLog record. A scheduled automation also runs this daily at 06:00.</p>
        <button onClick={handleSync} disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Pull Weather Forecasts Now
        </button>
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
    </div>
  );
}