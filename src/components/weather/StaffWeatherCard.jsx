import React from 'react';
import { useJobWeather } from '@/hooks/useJobWeather';
import { WEATHER_CODE_MAP, LEVEL_STYLES, assessConditions } from '@/utils/siteWeather';
import useEffectiveSettings from '@/hooks/useEffectiveSettings';
import {
  Wind, Droplets, Thermometer, MapPin, Cloud, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldX, Loader2,
} from 'lucide-react';

/**
 * StaffWeatherCard — the redesigned weather card shown to field staff when
 * they start / view a job. Shows current conditions, temperature, wind, and
 * a severity indicator (calm / caution / severe) with a one-line safety note
 * relevant to the work type.
 *
 * This is the single source of truth for on-site conditions in the field app.
 */
export default function StaffWeatherCard({ lat, lng, locationName, isDrillingJob }) {
  const { data: w, isLoading, error } = useJobWeather(lat, lng);
  const { settings: effectiveSettings } = useEffectiveSettings();

  // No coordinates
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">No weather — site coordinates not set</p>
          <p className="text-xs text-slate-400 mt-0.5">Ask your manager to set the job location for live weather.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin flex-shrink-0" />
        <p className="text-sm text-slate-500">Loading live weather…</p>
      </div>
    );
  }

  if (error || !w?.current) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Cloud className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">Weather unavailable right now.</p>
      </div>
    );
  }

  const code = w.current.weather_code;
  const wInfo = WEATHER_CODE_MAP[code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const temp = Math.round(w.current.temperature_2m);
  const feelsLike = Math.round(w.current.apparent_temperature);
  const assessment = assessConditions(w.current, w.daily?.[0], effectiveSettings);
  const windMph = assessment.windMph;
  const gustMph = assessment.gustMph;
  const lvl = LEVEL_STYLES[assessment.level];
  const daily = w.daily?.[0];
  const maxTemp = daily ? Math.round(daily.temperature_2m_max) : null;
  const minTemp = daily ? Math.round(daily.temperature_2m_min) : null;
  const rainProb = daily?.precipitation_probability_max ?? null;
  const SevIcon = lvl.icon;

  // Safety note — tailored to the work type
  const safetyNote = (() => {
    if (assessment.level === 'stop') {
      if (isDrillingJob && assessment.reasons.some(r => /wind/i.test(r))) {
        return 'Drilling should halt — wind speeds are too high to operate safely.';
      }
      if (assessment.reasons.some(r => /thunderstorm|lightning/i.test(r))) {
        return 'Stop outdoor work — thunderstorm activity in the area.';
      }
      if (assessment.reasons.some(r => /freezing/i.test(r))) {
        return 'Stop outdoor work — freezing rain makes surfaces hazardous.';
      }
      return 'Conditions are unsafe for outdoor work. Seek shelter and contact your supervisor.';
    }
    if (assessment.level === 'caution') {
      if (isDrillingJob && assessment.reasons.some(r => /wind/i.test(r))) {
        return 'Caution — wind is picking up. Secure loose materials and monitor conditions.';
      }
      if (assessment.reasons.some(r => /rain/i.test(r))) {
        return 'Caution — wet conditions. Take care on slippery surfaces and secure equipment.';
      }
      if (assessment.reasons.some(r => /snow|frost/i.test(r))) {
        return 'Caution — cold conditions. Dress warmly and watch for ice.';
      }
      return 'Take care — weather conditions require extra attention on site.';
    }
    return 'Conditions are good for outdoor work.';
  })();

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${lvl.border}`}>
      {/* Severity header bar */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 ${lvl.bg} border-b ${lvl.border}`}>
        <div className={`w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0`}>
          <SevIcon className={`w-5 h-5 ${lvl.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${lvl.text} uppercase tracking-wide`}>{lvl.label}</p>
          <p className="text-[11px] text-slate-600 leading-tight mt-0.5">{safetyNote}</p>
        </div>
      </div>

      {/* Main conditions */}
      <div className="px-4 py-3.5 bg-white">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${lvl.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-8 h-8 ${wInfo.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums leading-none">{temp}°C</span>
              <span className="text-sm text-slate-500 font-medium">{wInfo.label}</span>
            </div>
            {locationName && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" /> {locationName}
              </p>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="flex flex-col items-center bg-slate-50 rounded-lg py-2">
            <Thermometer className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
            <span className="text-[9px] text-slate-400 uppercase font-medium">Feels</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{feelsLike}°</span>
          </div>
          <div className="flex flex-col items-center bg-slate-50 rounded-lg py-2">
            <Wind className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
            <span className="text-[9px] text-slate-400 uppercase font-medium">Wind</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{windMph}<span className="text-[9px] font-normal">mph</span></span>
          </div>
          <div className="flex flex-col items-center bg-slate-50 rounded-lg py-2">
            <Droplets className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
            <span className="text-[9px] text-slate-400 uppercase font-medium">Rain</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{rainProb != null ? rainProb : '—'}<span className="text-[9px] font-normal">%</span></span>
          </div>
          <div className="flex flex-col items-center bg-slate-50 rounded-lg py-2">
            <span className="text-[9px] text-slate-400 uppercase font-medium mb-0.5">Range</span>
            <span className="text-[9px] text-slate-400 uppercase font-medium">Hi / Lo</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">
              {maxTemp != null ? <span className="text-red-500">{maxTemp}°</span> : '—'}
              {' / '}
              {minTemp != null ? <span className="text-blue-500">{minTemp}°</span> : '—'}
            </span>
          </div>
        </div>

        {/* Alert reasons strip */}
        {assessment.reasons.length > 0 && (
          <div className={`flex items-start gap-2 mt-3 rounded-lg px-3 py-2 ${lvl.bg} border ${lvl.border}`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${lvl.text} flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className={`text-[10px] font-bold ${lvl.text} uppercase tracking-wide`}>Weather Factors</p>
              <p className={`text-xs ${lvl.text} leading-relaxed`}>{assessment.reasons.join(' · ')}</p>
            </div>
          </div>
        )}

        {/* Gust detail for drilling jobs */}
        {isDrillingJob && assessment.level !== 'good' && (
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Gusts up to <strong className="text-slate-600">{gustMph} mph</strong> — {assessment.level === 'stop' ? 'drilling halted' : 'monitor closely'}
          </p>
        )}
      </div>
    </div>
  );
}