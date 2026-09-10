import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  MapPin, Navigation, Cloud, CloudRain, Sun, CloudSnow, Zap, Wind, Droplets,
  Mountain, Calendar, Target, TrendingUp, Phone, Mail, Building2, HardHat,
} from 'lucide-react';
import { getTotalMetres } from '@/utils/geotechBilling';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const weatherIcon = (code) => {
  if (code == null) return Cloud;
  if (code >= 95) return Zap;
  if (code >= 51 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code <= 3) return Cloud;
  return Sun;
};

export default function JobOverviewExtras({ job, client, contractor, invLogs, canSeeCosts, fin, isDrillingJob }) {
  // Live weather from the getJobWeatherStatus backend function
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['job-weather-status', job.id],
    queryFn: async () => { const res = await base44.functions.invoke('getJobWeatherStatus', { job_id: job.id }); return res.data; },
    enabled: !!job.id,
    retry: 0,
  });

  // Borehole count from investigation logs
  const boreholeRefs = new Set(invLogs.map(l => l.borehole_ref).filter(Boolean));
  const boreholeCount = boreholeRefs.size;
  const completedBoreholes = new Set(
    invLogs.filter(l => l.borehole_status === 'complete' && l.borehole_ref).map(l => l.borehole_ref)
  ).size;

  // Days elapsed vs planned
  const today = new Date();
  const start = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const end = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;
  const daysElapsed = start ? Math.max(0, Math.floor((today - start) / 86400000)) : 0;
  const daysPlanned = (start && end) ? Math.max(1, Math.floor((end - start) / 86400000) + 1) : 0;
  const dayPct = daysPlanned > 0 ? Math.min(100, Math.round((daysElapsed / daysPlanned) * 100)) : 0;

  // Metreage vs target
  const totalMetres = getTotalMetres(invLogs);
  const targetMetres = job.meterage_target || 0;
  const metrePct = targetMetres > 0 ? Math.min(100, Math.round((totalMetres / targetMetres) * 100)) : 0;

  // Cost per metre
  const totalCost = fin?.summary?.total_cost_net || 0;
  const costPerMetre = totalMetres > 0 ? totalCost / totalMetres : 0;

  const WIcon = weatherIcon(weather?.weather_code);

  return (
    <div className="space-y-3">
      {/* Contact Details + Site Info row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Client & Contractor Contacts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contacts</h3>
          </div>
          <div className="px-4 py-2 divide-y divide-slate-50">
            {client && (client.contact_name || client.contact_phone || client.contact_email) && (
              <div className="flex items-start gap-2 py-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">{client.name}</p>
                  {client.contact_name && <p className="text-sm text-slate-800 font-medium">{client.contact_name}</p>}
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    {client.contact_phone && (
                      <a href={`tel:${client.contact_phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {client.contact_phone}
                      </a>
                    )}
                    {client.contact_email && (
                      <a href={`mailto:${client.contact_email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" /> <span className="truncate">{client.contact_email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {contractor && (contractor.contact_name || contractor.contact_phone || contractor.contact_email) && (
              <div className="flex items-start gap-2 py-2">
                <HardHat className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">{contractor.name}</p>
                  {contractor.contact_name && <p className="text-sm text-slate-800 font-medium">{contractor.contact_name}</p>}
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    {contractor.contact_phone && (
                      <a href={`tel:${contractor.contact_phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {contractor.contact_phone}
                      </a>
                    )}
                    {contractor.contact_email && (
                      <a href={`mailto:${contractor.contact_email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" /> <span className="truncate">{contractor.contact_email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {job.site_contact_name && (
              <div className="flex items-start gap-2 py-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Site Contact</p>
                  <p className="text-sm text-slate-800 font-medium">{job.site_contact_name}</p>
                  {job.site_contact_phone && (
                    <a href={`tel:${job.site_contact_phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {job.site_contact_phone}
                    </a>
                  )}
                </div>
              </div>
            )}
            {!client?.contact_name && !contractor?.contact_name && !job.site_contact_name && (
              <p className="text-xs text-slate-400 py-3 text-center">No contact details set</p>
            )}
          </div>
        </div>

        {/* Site Info & Weather */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Site & Weather</h3>
          </div>
          <div className="px-4 py-2 divide-y divide-slate-50">
            {job.what3words && (
              <div className="flex items-center gap-2 py-2">
                <MapPin className="w-3.5 h-3.5 text-[#2E5A1A] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">What3Words</p>
                  <p className="text-sm text-slate-800 font-medium font-mono">{job.what3words}</p>
                </div>
              </div>
            )}
            {job.site_lat != null && job.site_lng != null && (
              <div className="flex items-center gap-2 py-2">
                <Navigation className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Coordinates</p>
                  <p className="text-sm text-slate-800 font-medium font-mono">{job.site_lat.toFixed(5)}, {job.site_lng.toFixed(5)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 py-2">
              <WIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Weather</p>
                {weatherLoading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : weather ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-800 font-medium">
                      {weather.temp_c != null ? `${Math.round(weather.temp_c)}°C` : ''}
                      {weather.description ? ` · ${weather.description}` : ''}
                    </p>
                    {weather.wind_mph != null && (
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Wind className="w-3 h-3" /> {Math.round(weather.wind_mph)}mph
                      </span>
                    )}
                    {weather.precip_mm != null && weather.precip_mm > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Droplets className="w-3 h-3" /> {weather.precip_mm}mm
                      </span>
                    )}
                    {weather.work_safe === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Do not work</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No weather data</p>
                )}
              </div>
            </div>
            {!job.what3words && job.site_lat == null && (
              <p className="text-xs text-slate-400 py-3 text-center">No site coordinates set</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress Stats — drilling jobs only */}
      {isDrillingJob && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-semibold text-slate-900">Progress Snapshot</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Days elapsed */}
          <div className="text-center bg-blue-50 rounded-lg border border-blue-100 p-2.5">
            <Calendar className="w-4 h-4 text-blue-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-slate-900 tabular-nums">{daysElapsed}<span className="text-xs text-slate-400">/{daysPlanned}</span></p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Days Elapsed</p>
          </div>
          {/* Boreholes */}
          <div className="text-center bg-violet-50 rounded-lg border border-violet-100 p-2.5">
            <Mountain className="w-4 h-4 text-violet-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-slate-900 tabular-nums">{completedBoreholes}<span className="text-xs text-slate-400">/{boreholeCount}</span></p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Boreholes Done</p>
          </div>
          {/* Metreage vs target */}
          <div className="text-center bg-emerald-50 rounded-lg border border-emerald-100 p-2.5">
            <Target className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-slate-900 tabular-nums">{totalMetres.toFixed(1)}m{targetMetres > 0 ? <span className="text-xs text-slate-400">/{targetMetres}m</span> : ''}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Drilled</p>
          </div>
          {/* Cost per metre */}
          {canSeeCosts && totalMetres > 0 && (
            <div className="text-center bg-amber-50 rounded-lg border border-amber-100 p-2.5">
              <span className="text-base font-bold text-slate-900">£</span>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{costPerMetre > 0 ? Math.round(costPerMetre) : 0}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Cost / m</p>
            </div>
          )}
        </div>
        {/* Progress bars */}
        {(dayPct > 0 || metrePct > 0) && (
          <div className="mt-3 space-y-2">
            {dayPct > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">Time elapsed</span>
                  <span className="text-slate-600 font-bold">{dayPct}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: dayPct + '%' }} />
                </div>
              </div>
            )}
            {metrePct > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">Metreage target</span>
                  <span className="text-slate-600 font-bold">{metrePct}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] rounded-full" style={{ width: metrePct + '%' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}