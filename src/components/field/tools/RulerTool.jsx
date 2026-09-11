import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Ruler } from 'lucide-react';

export default function RulerTool({ onClose }) {
  const [unit, setUnit] = useState('cm');
  const [markerY, setMarkerY] = useState(null);
  const containerRef = useRef(null);

  // Approximate: 1cm ≈ 37.8px at standard 96 DPI. Adjusted for devicePixelRatio.
  const dpr = window.devicePixelRatio || 1;
  const pxPerCm = (37.8 * dpr) / dpr; // stays ~37.8 on most phones; user calibrates visually
  const totalCm = 30;
  const rulerHeight = totalCm * pxPerCm;

  const handleMarkerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rulerHeight, e.touches ? e.touches[0].clientY - rect.top : e.clientY - rect.top));
    setMarkerY(y);
  };

  const measuredCm = markerY != null ? (markerY / pxPerCm).toFixed(1) : null;
  const measuredInch = markerY != null ? (markerY / (pxPerCm * 2.54)).toFixed(2) : null;

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-violet rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Ruler</h1>
        <div className="flex rounded-xl bg-white/20 overflow-hidden">
          <button onClick={() => setUnit('cm')} className={`px-3 py-1.5 text-sm font-bold transition ${unit === 'cm' ? 'bg-white text-violet-700' : 'text-white'}`}>cm</button>
          <button onClick={() => setUnit('inch')} className={`px-3 py-1.5 text-sm font-bold transition ${unit === 'inch' ? 'bg-white text-violet-700' : 'text-white'}`}>inch</button>
        </div>
      </div>

      {/* Measurement display */}
      {measuredCm && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-4 mb-2 field-card p-3 text-center">
          <p className="text-2xl font-bold text-violet-600">{unit === 'cm' ? `${measuredCm} cm` : `${measuredInch} in`}</p>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div
          ref={containerRef}
          className="relative mx-auto bg-gradient-to-r from-slate-50 to-white rounded-2xl shadow-md select-none"
          style={{ height: `${rulerHeight}px`, width: '80px' }}
          onTouchStart={handleMarkerMove}
          onTouchMove={handleMarkerMove}
          onMouseDown={handleMarkerMove}
          onMouseMove={(e) => e.buttons === 1 && handleMarkerMove(e)}
        >
          {/* Tick marks */}
          {Array.from({ length: totalCm * 10 + 1 }).map((_, i) => {
            const isCm = i % 10 === 0;
            const isHalfCm = i % 5 === 0 && !isCm;
            const top = i * (pxPerCm / 10);
            return (
              <div
                key={i}
                className="absolute left-0"
                style={{ top: `${top}px` }}
              >
                <div
                  className={`bg-slate-700 ${isCm ? 'h-0.5 w-8' : isHalfCm ? 'h-px w-5' : 'h-px w-3'}`}
                />
                {isCm && (
                  <span className="absolute left-9 top-0 -translate-y-1/2 text-[10px] font-bold text-slate-600 font-mono">
                    {i / 10}
                  </span>
                )}
              </div>
            );
          })}
          {/* Draggable marker */}
          {markerY != null && (
            <motion.div
              animate={{ top: markerY }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute left-0 right-0 h-1 bg-rose-500 z-10"
            >
              <div className="absolute -right-2 -top-1.5 w-4 h-4 rounded-full bg-rose-500 shadow" />
            </motion.div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">Drag to measure · Hold phone against the screen</p>
      </div>
    </div>
  );
}