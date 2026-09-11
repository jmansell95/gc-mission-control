import React from 'react';
import { motion } from 'framer-motion';

const VARIANTS = {
  primary: 'command-gradient text-white shadow-md',
  secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm',
  ghost: 'bg-white/15 text-white backdrop-blur border border-white/20',
  danger: 'bg-rose-500 text-white shadow-md',
};

export default function PlayfulButton({ children, onClick, className = '', variant = 'primary', icon: Icon, size = 'md', ...props }) {
  const sizes = {
    sm: 'px-3 py-2 text-xs rounded-xl',
    md: 'px-5 py-3 text-sm rounded-2xl',
    lg: 'px-6 py-4 text-base rounded-2xl',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 font-bold ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </motion.button>
  );
}