import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * FlowingLines — premium animated flowing lines in brand colours.
 * Renders N horizontal lines that flow across the screen with varying
 * speeds, opacities, and wave amplitudes. Subtle and elegant.
 */
export default function FlowingLines({ primaryColor = '#2E5A1A', accentColor = '#8DC63F', count = 12 }) {
  const lines = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      y: (i / count) * 100 + (Math.random() - 0.5) * 5,
      amplitude: 10 + Math.random() * 30,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 3,
      opacity: 0.05 + Math.random() * 0.12,
      color: i % 3 === 0 ? accentColor : primaryColor,
      strokeWidth: 1 + Math.random() * 1.5,
    }));
  }, [count, primaryColor, accentColor]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full" preserveAspectRatio="none">
        {lines.map(l => (
          <motion.path
            key={l.id}
            d={`M -10 ${l.y} Q 25 ${l.y - l.amplitude} 50 ${l.y} T 110 ${l.y}`}
            fill="none"
            stroke={l.color}
            strokeWidth={l.strokeWidth}
            opacity={l.opacity}
            initial={{ pathLength: 0, x: -100 }}
            animate={{ pathLength: 1, x: [0, 50, 0] }}
            transition={{
              pathLength: { duration: 2, delay: l.delay },
              x: { duration: l.duration, delay: l.delay, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        ))}
      </svg>
    </div>
  );
}