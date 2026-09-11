import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, MoveHorizontal, Smartphone, AlertCircle } from 'lucide-react';

export default function SpiritLevelTool({ onClose }) {
  const [gamma, setGamma] = useState(0);
  const [supported, setSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') { setSupported(false); return; }
    const handler = (e) => {
      if (e.gamma != null) { setGamma(e.gamma); setPermissionGranted(true); }
    };
    const requestPermission = async () => {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === 'granted') window.addEventListener('deviceorientation', handler);
          else setSupported(false);
        } catch { setSupported(false); }
      } else {
        window.addEventListener('deviceorientation', handler);
      }
    };
    requestPermission();
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  const isLevel = Math.abs(gamma) < 1.5;
  // Map gamma (-90..90) to bubble position (0..100%)
  const bubblePos = Math.max(0, Math.min(100, 50 + (gamma / 45) * 50));

  return (
    <div className="min-h-full flex flex-col">
      <div className="hero-vibrant rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Spirit Level</h1>
      </div>

      {!supported ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Sensor not available</p>
          <p className="text-xs text-slate-400 mt-1">Your device doesn't support tilt sensors.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          {/* Level indicator */}
          <motion.div animate={{ scale: isLevel ? 1.05 : 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div className={`px-6 py-3 rounded-2xl font-bold text-lg ${isLevel ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {isLevel ? '✓ LEVEL' : `${gamma > 0 ? '↗' : '↘'} ${Math.abs(gamma).toFixed(1)}°`}
            </div>
          </motion.div>

          {/* Bubble tube */}
          <div className="w-full max-w-sm">
            <div className="relative h-24 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 shadow-inner overflow-hidden">
              {/* Center markers */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30" />
              <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white/40" />
              {/* Bubble */}
              <motion.div
                animate={{ left: `${bubblePos}%` }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-white to-slate-200 shadow-lg flex items-center justify-center"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-200 to-sky-400" />
              </motion.div>
            </div>
            {/* Scale */}
            <div className="flex justify-between mt-2 px-2">
              {['-45°', '-30°', '-15°', '0°', '15°', '30°', '45°'].map(m => (
                <span key={m} className="text-[10px] text-slate-400 font-mono">{m}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Smartphone className="w-4 h-4" />
            <span>Place phone flat on the surface to check level</span>
          </div>
        </div>
      )}
    </div>
  );
}