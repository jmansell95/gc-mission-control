import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Copy, Check, Loader2, Navigation } from 'lucide-react';

export default function GpsCoordinatesTool({ onClose }) {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const getLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) { setError('GPS not available'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
        });
        setLoading(false);
      },
      () => { setError('Location permission denied'); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => { getLocation(); }, []);

  const copyToClipboard = () => {
    if (!coords) return;
    navigator.clipboard.writeText(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openMaps = () => {
    if (!coords) return;
    window.open(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`, '_blank');
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-indigo rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">GPS Coordinates</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500">Acquiring satellites…</p>
          </div>
        )}

        {error && (
          <div className="field-card p-6 text-center max-w-sm">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">{error}</p>
            <button onClick={getLocation} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-95 transition">Retry</button>
          </div>
        )}

        {coords && !loading && !error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-4">
            {/* Coordinates card */}
            <div className="stat-gradient-indigo rounded-3xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Navigation className="w-5 h-5" />
                <p className="text-sm font-bold text-white/80">Your Location</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider">Latitude</p>
                  <p className="text-2xl font-bold tabular-nums">{coords.lat.toFixed(6)}°</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider">Longitude</p>
                  <p className="text-2xl font-bold tabular-nums">{coords.lng.toFixed(6)}°</p>
                </div>
              </div>
            </div>

            {/* Accuracy */}
            <div className="field-card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Accuracy</p>
                <p className="text-lg font-bold text-slate-700">±{Math.round(coords.accuracy)} m</p>
              </div>
              {coords.altitude != null && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Altitude</p>
                  <p className="text-lg font-bold text-slate-700">{Math.round(coords.altitude)} m</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 text-white text-sm font-bold shadow-md"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span key="copied" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Copied!
                    </motion.span>
                  ) : (
                    <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                      <Copy className="w-4 h-4" /> Copy
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={openMaps}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold shadow-md"
              >
                <MapPin className="w-4 h-4" /> Maps
              </motion.button>
            </div>

            <button onClick={getLocation} className="w-full text-center text-xs text-slate-400 font-semibold py-2">↻ Refresh</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}