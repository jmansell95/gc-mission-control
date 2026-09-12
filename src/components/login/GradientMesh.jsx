import React from 'react';
import { motion } from 'framer-motion';

/**
 * GradientMesh — animated gradient mesh background in brand colours.
 * Multiple radial gradients that slowly shift position, creating a
 * premium, living background. Subtle and elegant — think Stripe.
 */
export default function GradientMesh({ primaryColor = '#2E5A1A', secondaryColor = '#1c4a12', accentColor = '#8DC63F' }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
        }}
      />
      {/* Animated radial blobs */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '60vw',
          height: '60vw',
          top: '-20%',
          left: '-10%',
          background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,
        }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '50vw',
          height: '50vw',
          bottom: '-15%',
          right: '-10%',
          background: `radial-gradient(circle, ${primaryColor}50 0%, transparent 70%)`,
        }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: '40vw',
          height: '40vw',
          top: '30%',
          right: '20%',
          background: `radial-gradient(circle, ${accentColor}25 0%, transparent 70%)`,
        }}
        animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />
    </div>
  );
}