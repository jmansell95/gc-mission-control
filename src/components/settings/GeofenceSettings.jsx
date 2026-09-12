import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Loader2, Save, Check, AlertTriangle, Radar, Bell, BellOff,
  LogIn, LogOut, Clock,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

const DEFAULT_CONFIG = {
  enabled: true,
  default_radius_meters: 100,
  notify_on_arrival: true,
  notify_on_departure: false,
  auto_arrival_on_rota: true,
};

export default function GeofenceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['geofence-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'geofence_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'geofence_config', label: 'Geofence Detection Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['geofence-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTestBatch = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('checkGeofencePresence', { action: 'batch' });
      const d = res.data || res;
      setTestResult({
        ok: !!d.ok,
        msg: d.error || `Checked ${d.vehicles_checked} vehicles — ${d.arrivals} arrival(s), ${d.departures} departure(s), ${d.auto_arrivals} auto check-in(s)`,
        arrivals: d.arrivals || 0,
        departures: d.departures || 0,
        autoArrivals: d.auto_arrivals || 0,
        vehiclesChecked: d.vehicles_checked || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['geofence-events'] });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Batch check failed' });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Radar}
        title="Geofence Detection"
        description="Automatically detects when a vehicle enters or leaves a geofence around a job site, supplier yard or client collection point. Uses live Geotab GPS data to trigger arrival/departure events, auto check-ins, and notifications. Each job uses its site coordinates (set via the geocode button on the job form); suppliers and clients can have yard/depot coordinates added on their records. A per-location radius override can be set if the default doesn't suit a particular site."
      />

      {/* Enable / Disable */}
      <div className={`rounded-xl border p-4 ${config.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="w-5 h-5 accent-[#2E5A1A]"
          />
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">{config.enabled ? 'Geofence Detection Active' : 'Geofence Detection Disabled'}</p>
            <p className="text-xs text-slate-500">
              {config.enabled
                ? 'Vehicle positions from Geotab are checked against job, supplier and client geofences in real time.'
                : 'No geofence events will be generated. Turn this on to start tracking arrivals and departures.'}
            </p>
          </div>
        </label>
      </div>

      {/* Radius configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Default Geofence Radius</h3>
        </div>
        <p className="text-xs text-slate-500">
          The radius (in metres) around a job site, supplier yard or client collection point that triggers an arrival event when a vehicle enters. 100m is a good default for most sites. You can override this per job (on the job form), per supplier (on the supplier record) or per client (on the client record) if a location needs a larger or smaller zone.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min="10"
            max="2000"
            step="10"
            value={config.default_radius_meters}
            onChange={(e) => setConfig({ ...config, default_radius_meters: Number(e.target.value) || 100 })}
            className={`${inputCls} max-w-[160px]`}
          />
          <span className="text-sm font-medium text-slate-600">metres</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[50, 100, 200, 500].map((r) => (
            <button
              key={r}
              onClick={() => setConfig({ ...config, default_radius_meters: r })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                config.default_radius_meters === r
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r}m
            </button>
          ))}
        </div>
      </div>

      {/* Behaviour toggles */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <SettingsSectionHeader icon={Clock} title="Detection Behaviour" description="" />
        </div>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={config.auto_arrival_on_rota}
            onChange={(e) => setConfig({ ...config, auto_arrival_on_rota: e.target.checked })}
            className="w-4 h-4 accent-[#2E5A1A]"
          />
          <LogIn className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-slate-700">Auto check-in on arrival</p>
            <p className="text-[11px] text-slate-400">When a vehicle enters its assigned job's geofence, automatically set "arrived on site" on the crew's rota assignment — no manual check-in needed.</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={config.notify_on_arrival}
            onChange={(e) => setConfig({ ...config, notify_on_arrival: e.target.checked })}
            className="w-4 h-4 accent-[#2E5A1A]"
          />
          <Bell className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-slate-700">Notify on arrival</p>
            <p className="text-[11px] text-slate-400">Send an alert when a vehicle arrives at a job site or supplier yard.</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={config.notify_on_departure}
            onChange={(e) => setConfig({ ...config, notify_on_departure: e.target.checked })}
            className="w-4 h-4 accent-[#2E5A1A]"
          />
          <LogOut className="w-4 h-4 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-slate-700">Notify on departure</p>
            <p className="text-[11px] text-slate-400">Send an alert when a vehicle leaves a job site or supplier yard.</p>
          </div>
        </label>
      </div>

      {/* Save + Test */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
          <button
            onClick={handleTestBatch}
            disabled={testing}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />} Run Batch Check Now
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          "Run Batch Check Now" reads the latest GPS position for every vehicle and checks it against all geofences. Use this to catch up after enabling geofencing for the first time, or to verify the system is detecting correctly.
        </p>
        {testResult && (
          <div className={`rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {testResult.msg}</p>
            {testResult.ok && testResult.vehiclesChecked > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Vehicles</p><p className="font-bold text-blue-700 tabular-nums">{testResult.vehiclesChecked}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Arrivals</p><p className="font-bold text-emerald-700 tabular-nums">{testResult.arrivals}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Auto Check-ins</p><p className="font-bold text-cyan-700 tabular-nums">{testResult.autoArrivals}</p></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}