import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, ShieldX, Thermometer, Wind, Droplets,
  Zap, MapPin, Loader2, Pencil, X, Save, RefreshCw, Cloud,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const WEATHER_CODE_MAP = {
  0: { label: 'Clear sky' }, 1: { label: 'Mainly clear' }, 2: { label: 'Partly cloudy' },
  3: { label: 'Overcast' }, 45: { label: 'Fog' }, 48: { label: 'Rime fog' },
  51: { label: 'Light drizzle' }, 53: { label: 'Drizzle' }, 55: { label: 'Heavy drizzle' },
  61: { label: 'Light rain' }, 63: { label: 'Rain' }, 65: { label: 'Heavy rain' },
  71: { label: 'Light snow' }, 73: { label: 'Snow' }, 75: { label: 'Heavy snow' },
  80: { label: 'Light showers' }, 81: { label: 'Showers' }, 82: { label: 'Heavy showers' },
  85: { label: 'Snow showers' }, 86: { label: 'Heavy snow showers' },
  95: { label: 'Thunderstorm' }, 96: { label: 'Thunderstorm + hail' }, 99: { label: 'Severe thunderstorm' },
};

const LEVEL_CONFIG = {
  okay: { label: 'Okay to Work', icon: ShieldCheck, color: 'text-primary', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500', grad: 'from-emerald-50 to-white' },
  caution: { label: 'Caution', icon: ShieldAlert, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500', grad: 'from-amber-50 to-white' },
  stop: { label: 'Do Not Work', icon: ShieldX, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300', dot: 'bg-rose-500', grad: 'from-rose-50 to-white' },
};

/**
 * WeatherWorkSafeCard — live "okay to work" indicator for a job.
 * Calls getJobWeatherStatus (which resolves per-job override ?? global
 * default thresholds and evaluates live site weather), shows the verdict
 * with current conditions and the active thresholds. An edit button opens a
 * modal to set per-job overrides (saved directly to the Job entity).
 */
export default function WeatherWorkSafeCard({ job }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['job-weather-status', job.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getJobWeatherStatus', { job_id: job.id });
      return res.data || res;
    },
    enabled: !!job.id && job.site_lat != null && job.site_lng != null,
    refetchInterval: 10 * 60 * 1000,
  });

  if (job.site_lat == null || job.site_lng == null) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-2.5">
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">Set the job location to see the work-safe weather check.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-2.5">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
        <p className="text-xs text-slate-500">Checking live weather conditions…</p>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-2.5">
        <Cloud className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500 flex-1">Weather check unavailable right now.</p>
        <button onClick={() => refetch()} className="p-1.5 text-slate-400 hover:text-primary transition"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  const level = data.level || 'okay';
  const lvl = LEVEL_CONFIG[level];
  const LvIcon = lvl.icon;
  const c = data.current || {};
  const t = data.thresholds || {};
  const wInfo = WEATHER_CODE_MAP[c.weather_code] || { label: '—' };

  const isOverridden = (field) => job[`weather_${field}`] != null;

  return (
    <div className={`hub-glass rounded-2xl overflow-hidden border-2 ${lvl.border}`}>
      <div className={`bg-gradient-to-br ${lvl.grad} px-4 py-3.5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl ${lvl.bg} border-2 ${lvl.border} flex items-center justify-center flex-shrink-0`}>
              <LvIcon className={`w-6 h-6 ${lvl.color}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-base font-extrabold ${lvl.color} leading-tight`}>{lvl.label}</p>
              <p className="text-[11px] text-slate-500 truncate">{wInfo.label} · {job.location || 'Site'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => refetch()} disabled={isFetching} className="p-1.5 text-slate-400 hover:text-primary transition rounded-lg hover:bg-white/60">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowEdit(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/70 hover:bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition active:scale-95">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
        </div>

        {/* Breached reasons */}
        {level !== 'okay' && (
          <div className={`mt-3 rounded-xl ${lvl.bg} border ${lvl.border} px-3 py-2`}>
            <ul className="space-y-0.5">
              {data.reasons.map((r, i) => (
                <li key={i} className={`text-[11px] ${lvl.color} flex items-start gap-1.5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot} mt-1.5 flex-shrink-0`} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Current conditions + thresholds */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ConditionStat icon={Thermometer} value={c.temp != null ? `${c.temp}°C` : '—'} label="Temperature" sub={t.temp_min != null || t.temp_max != null ? `${t.temp_min ?? '—'}–${t.temp_max ?? '—'}°C` : 'No limit'} overridden={isOverridden('temp_min') || isOverridden('temp_max')} />
        <ConditionStat icon={Wind} value={c.gust_mph != null ? `${c.gust_mph}` : '—'} label="Wind gusts" sub={t.wind_max_mph != null ? `max ${t.wind_max_mph} mph` : 'No limit'} overridden={isOverridden('wind_max_mph')} />
        <ConditionStat icon={Droplets} value={c.precip != null ? `${c.precip}` : '—'} label="Rain" sub={t.rain_max_mm != null ? `max ${t.rain_max_mm} mm` : 'No limit'} overridden={isOverridden('rain_max_mm')} />
        <ConditionStat icon={Zap} value={c.weather_code >= 95 ? 'Yes' : 'No'} label="Lightning" sub={t.lightning_block ? 'blocks work' : 'ignored'} overridden={isOverridden('lightning_block')} />
      </div>

      {showEdit && (
        <WeatherOverrideModal
          job={job}
          defaults={t}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ['job-weather-status', job.id] });
            queryClient.invalidateQueries({ queryKey: ['job', job.id] });
            toast({ title: 'Thresholds updated', description: 'Per-job overrides saved.', duration: 2000 });
          }}
        />
      )}
    </div>
  );
}

function ConditionStat({ icon: Icon, value, label, sub, overridden }) {
  return (
    <div className="text-center px-2 py-2 rounded-xl bg-slate-50 border border-slate-100">
      <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
      <p className="text-sm font-bold text-slate-800 tabular-nums leading-tight">{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-[9px] text-slate-400 mt-0.5 flex items-center justify-center gap-0.5">
        {sub}
        {overridden && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Overridden for this job" />}
      </p>
    </div>
  );
}

function WeatherOverrideModal({ job, defaults, onClose, onSaved }) {
  const [form, setForm] = useState({
    temp_min: job.weather_temp_min ?? '',
    temp_max: job.weather_temp_max ?? '',
    wind_max_mph: job.weather_wind_max_mph ?? '',
    rain_max_mm: job.weather_rain_max_mm ?? '',
    lightning_block: job.weather_lightning_block ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toNum = (v) => (v === '' || v == null ? null : Number(v));
      const toBool = (v) => (v === '' || v == null ? null : Boolean(v));
      await base44.entities.Job.update(job.id, {
        weather_temp_min: toNum(form.temp_min),
        weather_temp_max: toNum(form.temp_max),
        weather_wind_max_mph: toNum(form.wind_max_mph),
        weather_rain_max_mm: toNum(form.rain_max_mm),
        weather_lightning_block: toBool(form.lightning_block),
      });
      onSaved();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, {
        weather_temp_min: null,
        weather_temp_max: null,
        weather_wind_max_mph: null,
        weather_rain_max_mm: null,
        weather_lightning_block: null,
      });
      onSaved();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Weather Thresholds — {job.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            Override the company defaults for this job only. Leave a field blank to use the global default ({defaults.temp_min ?? '—'}–{defaults.temp_max ?? '—'}°C, wind {defaults.wind_max_mph ?? '—'} mph, rain {defaults.rain_max_mm ?? '—'} mm).
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <OverrideField icon={Thermometer} label="Min temp (°C)" value={form.temp_min} onChange={v => setForm(p => ({ ...p, temp_min: v }))} placeholder={defaults.temp_min} />
            <OverrideField icon={Thermometer} label="Max temp (°C)" value={form.temp_max} onChange={v => setForm(p => ({ ...p, temp_max: v }))} placeholder={defaults.temp_max} />
            <OverrideField icon={Wind} label="Max wind (mph)" value={form.wind_max_mph} onChange={v => setForm(p => ({ ...p, wind_max_mph: v }))} placeholder={defaults.wind_max_mph} />
            <OverrideField icon={Droplets} label="Max rain (mm)" value={form.rain_max_mm} onChange={v => setForm(p => ({ ...p, rain_max_mm: v }))} placeholder={defaults.rain_max_mm} />
          </div>
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-slate-700">Block in thunderstorms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setForm(p => ({ ...p, lightning_block: '' }))} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${form.lightning_block === '' ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-400 border border-slate-200'}`}>Default</button>
              <button onClick={() => setForm(p => ({ ...p, lightning_block: true }))} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${form.lightning_block === true ? 'bg-primary text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Yes</button>
              <button onClick={() => setForm(p => ({ ...p, lightning_block: false }))} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${form.lightning_block === false ? 'bg-rose-100 text-rose-700' : 'bg-white text-slate-400 border border-slate-200'}`}>No</button>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button onClick={handleClear} disabled={saving} className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition">Reset to defaults</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 active:scale-95 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Override
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideField({ icon: Icon, label, value, onChange, placeholder }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <p className="text-[11px] font-bold text-slate-700">{label}</p>
      </div>
      <input
        type="number"
        value={value === '' ? '' : value}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder != null ? `Default: ${placeholder}` : '—'}
        className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold tabular-nums focus:outline-none focus:border-primary"
      />
    </div>
  );
}