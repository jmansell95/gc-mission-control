import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fireConfetti } from '@/lib/fieldAnimations';
import { CheckCircle2 } from 'lucide-react';

export default function CelebrationOverlay({ show, message = 'Complete!', onClose, autoCloseMs = 2000 }) {
  useEffect(() => {
    if (show) {
      fireConfetti();
      if (autoCloseMs) {
        const t = setTimeout(onClose, autoCloseMs);
        return () => clearTimeout(t);
      }
    }
  }, [show, autoCloseMs, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl mx-6"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
              <CheckCircle2 className="w-20 h-20 text-emerald-500" />
            </motion.div>
            <p className="text-xl font-bold text-slate-800">{message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}