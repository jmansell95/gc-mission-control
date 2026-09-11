import React from 'react';
import { motion } from 'framer-motion';

const GRADIENTS = {
  brand: 'hero-gradient',
  blue: 'hero-vibrant-blue',
  amber: 'hero-vibrant-amber',
  vibrant: 'hero-vibrant',
};

export default function GradientFieldHeader({ title, subtitle, icon: Icon, children, accent = 'brand' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`${GRADIENTS[accent] || GRADIENTS.brand} rounded-3xl p-5 text-white shadow-lg relative overflow-hidden`}
    >
      {/* Decorative blurred circles */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 blur-lg" />

      <div className="relative flex items-center gap-3">
        {Icon && (
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0"
          >
            <Icon className="w-6 h-6" />
          </motion.div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold truncate">{title}</h1>
          {subtitle && <p className="text-sm text-white/80 truncate">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="relative mt-3">{children}</div>}
    </motion.div>
  );
}