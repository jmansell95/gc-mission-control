import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Compass, AlertCircle } from 'lucide-react';

export default function CompassTool({ onClose }) {
  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') { setSupported(false); return; }
    const handler = (e) => {
      // iOS provides webkitCompassHeading (absolute heading from north)
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        setHeading(360 - e.alpha);
      }
    };
    const start = async () => {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === 'granted') window.addEventListener('deviceorientation', handler, true);
          else setSupported(false);
        } catch { setSupported(false); }
      } else {
        window.addEventListener('deviceorientationabsolute', handler, true);
        window.addEventListener('deviceorientation', handler, true);
      }
    };
    start();
    return () => {
      window.removeEventListener('deviceorientation', handler, true);
      window.removeEventListener('deviceorientationabsolute', handler, true);
    };
  }, []);

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dirIdx = Math.round(heading / 45) % 8;
  const cardinal = directions[dirIdx];

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-rose rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Compass</h1>
      </div>

      {!supported ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Sensor not available</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Heading display */}
          <motion.div key={cardinal} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
            <div className="text-center">
              <p className="text-6xl font-bold text-slate-800">{Math.round(heading)}°</p>
              <p className="text-2xl font-bold text-rose-500 mt-1">{cardinal}</p>
            </div>
          </motion.div>

          {/* Compass dial */}
          <div className="relative w-64 h-64">
            <motion.div
              animate={{ rotate: -heading }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 shadow-lg"
            >
              {/* Cardinal points */}
              {['N', 'E', 'S', 'W'].map((dir, i) => (
                <div
                  key={dir}
                  className="absolute font-bold text-lg"
                  style={{
                    top: dir === 'N' ? '8px' : dir === 'S' ? 'auto' : '50%',
                    bottom: dir === 'S' ? '8px' : 'auto',
                    left: dir === 'W' ? '8px' : dir === 'E' ? 'auto' : '50%',
                    right: dir === 'E' ? '8px' : 'auto',
                    transform: dir === 'N' || dir === 'S' ? 'translateX(-50%)' : 'translateY(-50%)',
                    color: dir === 'N' ? '#e11d48' : '#475569',
                  }}
                >{dir}</div>
              ))}
              {/* Tick marks */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 top-0 w-0.5 origin-bottom"
                  style={{
                    height: i % 6 === 0 ? '16px' : '8px',
                    background: i % 6 === 0 ? '#64748b' : '#cbd5e1',
                    transform: `translateX(-50%) rotate(${i * 15}deg)`,
                    transformOrigin: 'center 128px',
                  }}
                />
              ))}
              {/* Needle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-44">
                <div className="w-full h-1/2 bg-gradient-to-t from-transparent to-rose-500 rounded-full" />
                <div className="w-full h-1/2 bg-gradient-to-b from-transparent to-slate-400 rounded-full" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-700 shadow" />
            </motion.div>
            {/* Fixed top arrow indicator */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
              <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-rose-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}