import React from 'react';
import { motion } from 'framer-motion';

/**
 * InsightCard — the flagship modern card for the redesigned dashboard.
 *
 * Polished surface with layered shadows, optional gradient header strip,
 * status accent stripe, and hover lift. Pure visual — no logic.
 *
 * Props:
 * - icon: lucide icon component
 * - title: heading text
 * - subtitle: muted subtitle text
 * - action: node rendered in the header right side
 * - accent: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate' | 'cyan' — left stripe colour
 * - gradientHeader: boolean — render a subtle gradient header band
 * - interactive: boolean — enable hover lift
 * - children: body content
 * - bodyClassName: extra classes for the body wrapper
 */
const ACCENT_MAP = {
  emerald: 'linear-gradient(180deg, #10b981, #059669)',
  blue: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
  amber: 'linear-gradient(180deg, #f59e0b, #d97706)',
  rose: 'linear-gradient(180deg, #f43f5e, #be123c)',
  violet: 'linear-gradient(180deg, #8b5cf6, #6d28d9)',
  slate: 'linear-gradient(180deg, #94a3b8, #64748b)',
  cyan: 'linear-gradient(180deg, #06b6d4, #0e7490)',
  indigo: 'linear-gradient(180deg, #6366f1, #4338ca)',
  teal: 'linear-gradient(180deg, #14b8a6, #0f766e)',
  orange: 'linear-gradient(180deg, #f97316, #ea580c)',
};

const ICON_GRADIENT_MAP = {
  emerald: 'from-emerald-500 to-teal-600',
  blue: 'from-blue-500 to-indigo-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-red-600',
  violet: 'from-violet-500 to-purple-600',
  slate: 'from-slate-400 to-slate-600',
  cyan: 'from-cyan-500 to-sky-600',
  indigo: 'from-indigo-500 to-blue-600',
  teal: 'from-teal-500 to-emerald-600',
  orange: 'from-orange-500 to-amber-600',
};

export default function InsightCard({
  icon: Icon,
  title,
  subtitle,
  action,
  accent,
  gradientHeader = false,
  interactive = false,
  children,
  bodyClassName = 'p-5',
  animate = false,
  delay = 0,
}) {
  const accentColor = accent ? ACCENT_MAP[accent] : null;
  const iconGradient = accent ? ICON_GRADIENT_MAP[accent] : 'from-emerald-500 to-teal-600';

  const card = (
    <div
      className={`relative rounded-2xl overflow-hidden ${interactive ? 'hub-glass cursor-pointer' : 'hub-glass'} ${accent ? 'hub-glass-accent' : ''}`}
      style={accentColor ? { '--accent-color': accentColor } : undefined}
    >
      {/* Header */}
      {(title || Icon || action) && (
        <div className={`px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 ${gradientHeader ? 'bg-gradient-to-r from-slate-50/90 via-white to-white' : 'border-b border-slate-100/80'} relative`}>
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-base font-bold text-slate-900 truncate tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex-shrink-0 w-full sm:w-auto flex justify-end">{action}</div>}
        </div>
      )}
      {/* Body */}
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.06, duration: 0.35, ease: 'easeOut' }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}