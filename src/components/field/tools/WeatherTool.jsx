import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Sun, Wind, Droplets, Thermometer, MapPin, Loader2 } from 'lucide-react';

const WMO_ICONS = {
  0: { icon: Sun, label: 'Clear sky', color: 'text-amber-500' },
  1: { icon: Sun, label: 'Mainly clear', color: 'text-amber-500' },
  2: { icon: CloudSun, label: 'Partly cloudy', color: 'text-slate-400' },
  3: { icon: Cloud, label: 'Overcast', color: 'text-slate-400' },
  45: { icon: CloudFog, label: 'Fog', color: 'text-slate-400' },
  48: { icon: CloudFog, label: 'Rime fog', color: 'text-slate-400' },
  51: { icon: CloudDrizzle, label: 'Light drizzle', color: 'text-blue-400' },
  53: { icon: CloudDrizzle, label: 'Drizzle', color: 'text-blue-400' },
  55: { icon: CloudDrizzle, label: 'Heavy drizzle', color: 'text-blue-400' },
  61: { icon: CloudRain, label: 'Light rain', color: 'text-blue-500' },
  63: { icon: CloudRain, label: 'Rain', color: 'text-blue-500' },
  65: { icon: CloudRain, label: 'Heavy rain', color: 'text-blue-500' },
  71: { icon: CloudSnow, label: 'Light snow', color: 'text-cyan-400' },
  73: { icon: CloudSnow, label: 'Snow', color: 'text-cyan-400' },
  75: { icon: CloudSnow, label: 'Heavy snow', color: 'text-cyan-400' },
  80: { icon: CloudRain, label: 'Rain showers', color: 'text-blue-500' },
  81: { icon: CloudRain, label: 'Rain showers', color: 'text-blue-500' },
  82: { icon: CloudRain, label: 'Violent showers', color: 'text-blue-600' },
  95: { icon: CloudLightning, label: 'Thunderstorm', color: 'text-amber-600' },
  96: { icon: CloudLightning, label: 'Storm + hail', color: 'text-amber-600' },
  99: { icon: CloudLightning, label: 'Heavy storm + hail', color: 'text-amber-600' },
};

const getWmo = (code) => WMO_ICONS[code] || { icon: Cloud, label: 'Unknown', color: 'text-slate-400' };

export default function WeatherTool({ onClose }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) { setError('GPS not available'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
          const res = await fetch(url);
          const data = await res.json();
          setWeather(data);
        } catch (e) { setError('Could not fetch weather'); }
        setLoading(false);
      },
      () => { setError('Location permission denied'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <div className="hero-vibrant-blue p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Weather</h1>
      </div>

      <div className="flex-1 p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-500">Getting your location…</p>
          </div>
        )}

        {error && (
          <div className="field-card p-6 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Allow location access to see live weather.</p>
          </div>
        )}

        {weather && !loading && !error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Current conditions */}
            <div className="hero-vibrant-blue rounded-3xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Current</p>
                  <motion.p initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }} className="text-5xl font-bold">
                    {Math.round(weather.current.temperature_2m)}°C
                  </motion.p>
                  <p className="text-sm text-white/80 mt-1">{getWmo(weather.current.weather_code).label}</p>
                </div>
                {(() => {
                  const WmoIcon = getWmo(weather.current.weather_code).icon;
                  return <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }}><WmoIcon className="w-20 h-20 text-white/90" /></motion.div>;
                })()}
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-sm text-white/80"><Wind className="w-4 h-4" /> {Math.round(weather.current.wind_speed_10m)} km/h</div>
                <div className="flex items-center gap-1.5 text-sm text-white/80"><Droplets className="w-4 h-4" /> {weather.current.relative_humidity_2m}%</div>
              </div>
            </div>

            {/* 5-day forecast */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">5-Day Forecast</p>
              {weather.daily.time.map((date, i) => {
                const w = getWmo(weather.daily.weather_code[i]);
                const WIcon = w.icon;
                return (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="field-card p-3 flex items-center gap-3"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center ${w.color}`}>
                      <WIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-700">
                        {i === 0 ? 'Today' : new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })}
                      </p>
                      <p className="text-xs text-slate-400">{w.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-700">{Math.round(weather.daily.temperature_2m_max[i])}°</p>
                      <p className="text-xs text-slate-400">{Math.round(weather.daily.temperature_2m_min[i])}°</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}