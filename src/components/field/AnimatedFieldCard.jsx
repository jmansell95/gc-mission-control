import React from 'react';
import { motion } from 'framer-motion';
import { slideUp, bounceTap } from '@/lib/fieldAnimations';

export default function AnimatedFieldCard({ children, className = '', onClick, delay = 0, ...props }) {
  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      whileTap={onClick ? bounceTap.whileTap : undefined}
      className={`field-card p-4 ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.div>
  );
}