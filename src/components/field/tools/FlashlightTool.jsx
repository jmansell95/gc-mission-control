import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Flashlight, AlertCircle } from 'lucide-react';

export default function FlashlightTool({ onClose }) {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const toggleTorch = async () => {
    try {
      if (on) {
        // Turn off
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        setOn(false);
      } else {
        // Turn on
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (!caps.torch) { setError('Torch not supported on this device'); track.stop(); streamRef.current = null; return; }
        await track.applyConstraints({ advanced: [{ torch: true }] });
        setOn(true);
      }
    } catch (e) {
      setError('Could not access camera. Allow camera permission to use the flashlight.');
      setSupported(false);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-amber rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Flashlight</h1>
      </div>

      {error && (
        <div className="mx-4 mb-4 field-card p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {/* Big toggle button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={toggleTorch}
          className={`relative w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-colors ${
            on ? 'bg-gradient-to-br from-amber-400 to-amber-600 glow-amber' : 'bg-gradient-to-br from-slate-700 to-slate-900'
          }`}
        >
          {on && (
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-amber-400"
            />
          )}
          <Flashlight className={`w-16 h-16 relative z-10 ${on ? 'text-white' : 'text-slate-400'}`} />
        </motion.button>

        <AnimatePresence mode="wait">
          <motion.p
            key={on ? 'on' : 'off'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`text-lg font-bold ${on ? 'text-amber-600' : 'text-slate-400'}`}
          >
            {on ? 'ON — Tap to turn off' : 'Tap to turn on'}
          </motion.p>
        </AnimatePresence>

        {supported && !error && (
          <p className="text-xs text-slate-400 text-center max-w-xs px-6">
            Uses your phone's camera flash. Keep the app open while the torch is on.
          </p>
        )}
      </div>
    </div>
  );
}