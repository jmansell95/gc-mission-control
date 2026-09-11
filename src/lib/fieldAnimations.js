import confetti from 'canvas-confetti';

// === Spring presets (playful & bold) ===
export const springConfig = {
  bouncy: { type: 'spring', stiffness: 350, damping: 15 },
  snappy: { type: 'spring', stiffness: 400, damping: 20 },
  gentle: { type: 'spring', stiffness: 200, damping: 25 },
};

// === Motion variants ===
export const slideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 15 } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

export const bounceTap = {
  whileTap: { scale: 0.95 },
  whileHover: { scale: 1.02 },
};

export const springPop = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 15 } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

// === Celebration confetti ===
export function fireConfetti() {
  const defaults = { spread: 70, startVelocity: 45, ticks: 80, zIndex: 9999, particleCount: 80 };
  confetti({ ...defaults, origin: { x: 0.2, y: 0.6 } });
  confetti({ ...defaults, origin: { x: 0.8, y: 0.6 } });
  setTimeout(() => confetti({ ...defaults, origin: { x: 0.5, y: 0.5 }, particleCount: 60 }), 200);
}