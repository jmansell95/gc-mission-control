import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PageLoadingOverlay({ isLoading, pageName }) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-white/70 backdrop-blur-md pointer-events-none"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary/15 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-[#2E5A1A] rounded-full animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-700 tracking-tight">
              {pageName ? `${pageName} is loading…` : 'Loading…'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}