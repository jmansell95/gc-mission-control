import React from 'react';
import { useJobWeather } from '@/hooks/useJobWeather';
import { WEATHER_CODE_MAP, assessConditions } from '@/utils/siteWeather';
import { Cloud, Loader2, AlertTriangle } from 'lucide-react';

/**
 * RotaWeatherBadge — tiny inline weather flag shown on rota assignment cards.
 * Fetches live weather for the job's site coordinates (cached 10 min via React Query,
 * deduplicated by rounded coords so multiple cards for the same job share one call).
 *
 * Shows a coloured icon + temperature. Red/amber tint when conditions are unsafe
 * (high wind, thunderstorm, freezing rain, heavy snow) so managers can see at a
 * glance whether a site is workable today.
 */
export default function RotaWeatherBadge({ job }) {
  const lat = job?.site_lat;
  const lng = job?.site_lng;
  const enabled = lat != null && !isNaN(lat) && lng != null && !isNaN(lng);
  const { data: weather, isLoading } = useJobWeather(lat, lng, enabled);

  if (!enabled) return null;
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-0.5 text-slate-300" title="Loading weather…">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      </span>
    );
  }
  if (!weather?.current) return null;

  const code = weather.current.weather_code ?? 0;
  const meta = WEATHER_CODE_MAP[code] || { icon: Cloud, color: 'text-slate-400' };
  const temp = weather.current.temperature_2m != null
    ? Math.round(weather.current.temperature_2m) + '°'
    : '';
  const { level } = assessConditions(weather.current, weather.daily?.[0]);

  const levelColor =
    level === 'stop' ? 'text-rose-600' :
    level === 'caution' ? 'text-amber-600' :
    'text-slate-500';

  const Icon = meta.icon;
  const title = `${meta.label}${temp ? ', ' + temp : ''}${level === 'stop' ? ' — DO NOT WORK' : level === 'caution' ? ' — caution' : ''}`;

  return (
    <span className={`inline-flex items-center gap-0.5 ${levelColor}`} title={title}>
      {level === 'stop'
        ? <AlertTriangle className="w-2.5 h-2.5" />
        : <Icon className="w-2.5 h-2.5" />}
      {temp && <span className="text-[10px] font-medium tabular-nums">{temp}</span>}
    </span>
  );
}