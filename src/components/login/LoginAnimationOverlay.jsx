import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDivisionLoginConfig } from '@/hooks/useDivisionLoginConfig';
import DivisionLoginAnimation from './DivisionLoginAnimation';
import { EMBLEM_URL } from '@/components/Logo';

/**
 * LoginAnimationOverlay — full-screen branded loading animation that
 * plays after the user clicks "Sign In" and while the app authenticates.
 *
 * Renders the division's configured animation full-screen, with the
 * division logo (or GC emblem), welcome text, tagline, and a progress bar.
 * Auto-dismisses after the configured duration, or when onDone is called
 * (whichever comes first).
 *
 * Props:
 *   email — the user's email (for division detection)
 *   onDone — callback when the animation should dismiss
 *   forceShow — when true, shows even if no config (uses defaults)
 */
export default function LoginAnimationOverlay({ email, onDone, forceShow = false }) {
  const config = useDivisionLoginConfig(email);
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const duration = config?.durationMs || 2500;
  const transitionStyle = config?.transitionStyle || 'fade';

  useEffect(() => {
    if (!config && !forceShow) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDoneRef.current?.(), 400); // wait for exit animation
    }, duration);
    return () => clearTimeout(timer);
  }, [config, duration, forceShow]);

  if (!config && !forceShow) return null;

  const exitVariants = {
    fade: { opacity: 0 },
    slide_up: { opacity: 0, y: '-100%' },
    zoom: { opacity: 0, scale: 1.1 },
    slide_right: { opacity: 0, x: '100%' },
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          initial={{ opacity: 1 }}
          exit={exitVariants[transitionStyle] || exitVariants.fade}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <DivisionLoginAnimation config={config} fullScreen />

          {/* Content layer */}
          <div className="relative z-10 flex flex-col items-center text-center px-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              className="mb-6"
            >
              {config?.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt={config?.division?.name || 'Logo'}
                  className="h-20 w-auto object-contain drop-shadow-2xl"
                />
              ) : (
                <img
                  src={EMBLEM_URL}
                  alt="Ground Control"
                  className="h-20 w-auto object-contain drop-shadow-2xl"
                />
              )}
            </motion.div>

            {/* Welcome text */}
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg"
            >
              {config?.welcomeText || 'Welcome back'}
            </motion.h1>

            {/* Tagline */}
            {config?.tagline && (
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-lg text-white/70 mt-2 font-medium drop-shadow-sm"
              >
                {config.tagline}
              </motion.p>
            )}

            {/* Progress bar */}
            {config?.showProgressBar !== false && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.3 }}
                className="mt-8 w-48 h-1 rounded-full bg-white/20 overflow-hidden"
              >
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: duration / 1000, ease: 'easeInOut' }}
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}