import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CircleDot, AlertCircle } from 'lucide-react';

export default function BubbleLevelTool({ onClose }) {
  const [beta, setBeta] = useState(0);
  const [gamma, setGamma] = useState(0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') { setSupported(false); return; }
    const handler = (e) => {
      if (e.beta != null) setBeta(e.beta);
      if (e.gamma != null) setGamma(e.gamma);
    };
    const start = async () => {
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
    start();
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // For a phone lying flat (screen up), beta ≈ 0 and gamma ≈ 0 when level.
  // When the phone is tilted, beta (front-back) and gamma (left-right) change.
  // We map to bubble position: x from gamma, y from beta.
  const isLevel = Math.abs(beta) < 1.5 && Math.abs(gamma) < 1.5;
  const bubbleX = Math.max(-45, Math.min(45, gamma));
  const bubbleY = Math.max(-45, Math.min(45, beta));
  // Convert to percentage within the circle
  const posX = 50 + (bubbleX / 45) * 40;
  const posY = 50 + (bubbleY / 45) * 40;

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-teal rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Bubble Level</h1>
      </div>

      {!supported ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Sensor not available</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {/* Level status */}
          <motion.div animate={{ scale: isLevel ? 1.05 : 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div className={`px-6 py-3 rounded-2xl font-bold text-lg ${isLevel ? 'bg-emerald-500 text-white glow-emerald' : 'bg-slate-200 text-slate-500'}`}>
              {isLevel ? '✓ LEVEL' : 'Tilt to level'}
            </div>
          </motion.div>

          {/* Bubble circle */}
          <div className="relative w-64 h-64">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-inner" />
            {/* Inner circle */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-slate-700 to-slate-800" />
            {/* Crosshairs */}
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/20 -translate-y-1/2" />
            <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-white/20 -translate-x-1/2" />
            {/* Center target */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/30" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40" />
            {/* Bubble */}
            <motion.div
              animate={{ left: `${posX}%`, top: `${posY}%` }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-white to-slate-100 shadow-lg flex items-center justify-center"
            >
              <div className={`w-10 h-10 rounded-full transition-colors ${isLevel ? 'bg-emerald-400' : 'bg-sky-300'}`} />
            </motion.div>
          </div>

          {/* Axis readouts */}
          <div className="flex gap-4">
            <div className="field-card px-4 py-2 text-center">
              <p className="text-xs text-slate-400">X (tilt)</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums">{gamma.toFixed(1)}°</p>
            </div>
            <div className="field-card px-4 py-2 text-center">
              <p className="text-xs text-slate-400">Y (pitch)</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums">{beta.toFixed(1)}°</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center max-w-xs">Place phone flat on the surface. The bubble centers when both axes are level.</p>
        </div>
      )}
    </div>
  );
}