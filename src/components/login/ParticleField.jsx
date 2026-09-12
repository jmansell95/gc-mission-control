import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * ParticleField — premium floating particles in brand colours.
 * Renders N particles with random positions, sizes, and drift durations.
 * Used as a login page animated background.
 */
export default function ParticleField({ primaryColor = '#2E5A1A', accentColor = '#8DC63F', count = 40 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 5,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 5,
      drift: (Math.random() - 0.5) * 40,
      opacity: 0.15 + Math.random() * 0.35,
      color: Math.random() > 0.5 ? accentColor : primaryColor,
    }));
  }, [count, primaryColor, accentColor]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{
            y: [0, p.drift, 0],
            x: [0, p.drift * 0.5, 0],
            opacity: [p.opacity, p.opacity * 1.8, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}