import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Gauge, AlertCircle } from 'lucide-react';

export default function ClinometerTool({ onClose }) {
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

  // Angle from horizontal: when phone is upright (screen facing you), beta ≈ 90.
  // The inclination angle from horizontal = beta - 0 (flat) ... but for a clinometer
  // held on its side looking along the top edge, the pitch angle = |beta| when measured from flat.
  // We show the angle from the vertical (upright) position, which is |90 - beta|.
  const angle = Math.abs(90 - Math.abs(beta));
  const tilt = gamma;

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-orange rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Clinometer</h1>
      </div>

      {!supported ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Sensor not available</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {/* Angle display */}
          <motion.div key={Math.round(angle)} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div className="text-center">
              <p className="text-6xl font-bold text-orange-600 tabular-nums">{angle.toFixed(1)}°</p>
              <p className="text-sm text-slate-400 mt-1">from horizontal</p>
            </div>
          </motion.div>

          {/* Protractor visualization */}
          <div className="relative w-64 h-32">
            {/* Semicircle background */}
            <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full border-4 border-slate-200 border-b-0" />
              {/* Angle marks */}
              {[-90, -60, -45, -30, 0, 30, 45, 60, 90].map(deg => (
                <div
                  key={deg}
                  className="absolute bottom-0 left-1/2 origin-bottom"
                  style={{ transform: `rotate(${deg}deg)`, height: deg % 30 === 0 ? '40px' : '28px' }}
                >
                  <div className={`w-0.5 ${deg % 30 === 0 ? 'h-full bg-slate-400' : 'h-full bg-slate-200'}`} />
                  <span className="absolute -top-4 left-1 text-[9px] text-slate-400 font-mono">{Math.abs(deg)}°</span>
                </div>
              ))}
              {/* Angle indicator line */}
              <motion.div
                animate={{ rotate: -angle }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="absolute bottom-0 left-1/2 origin-bottom w-1 h-28 -ml-0.5"
              >
                <div className="w-full h-full bg-gradient-to-t from-orange-500 to-orange-300 rounded-full" />
              </motion.div>
              {/* Center dot */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-orange-600 -mb-1.5" />
            </div>
          </div>

          {/* Side tilt */}
          <div className="field-card px-6 py-3 flex items-center gap-3">
            <Gauge className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">Side tilt:</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums">{tilt.toFixed(1)}°</span>
          </div>

          <p className="text-xs text-slate-400 text-center max-w-xs">
            Hold the phone on its side, top edge pointing at your target. The angle shows the slope from horizontal.
          </p>
        </div>
      )}
    </div>
  );
}