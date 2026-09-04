import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudSun, X } from 'lucide-react';
import StaffWeatherCard from '@/components/weather/StaffWeatherCard';

// Compact button that reveals the live weather card in a popup on demand,
// instead of always showing the weather at the bottom of the job flow.
export default function WeatherToggleButton({ lat, lng, locationName, isDrillingJob }) {
  const [open, setOpen] = useState(false);

  if (lat == null || lng == null) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-sm font-semibold transition border border-sky-200"
      >
        <span className="flex items-center gap-2">
          <CloudSun className="w-4 h-4 text-sky-600" /> View Live Weather
        </span>
        <span className="text-xs text-sky-600 font-medium">Tap to view</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-sky-50 to-sky-100/50 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
                    <CloudSun className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Live Site Weather</h3>
                    <p className="text-xs text-slate-500">{locationName || 'Site location'}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-4">
                <StaffWeatherCard lat={lat} lng={lng} locationName={locationName} isDrillingJob={isDrillingJob} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}