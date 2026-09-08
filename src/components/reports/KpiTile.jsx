import React from 'react';
import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';
import TrendDelta from './TrendDelta';

/**
 * KpiTile — a single gradient KPI tile with animated counter, trend delta
 * badge, and click-to-drill. Used by ReportStatTiles and all native report
 * sections.
 *
 * Props:
 *  - label, value (number), format ('currency'|'number'|'percentage')
 *  - icon: lucide icon component
 *  - gradient: stat-gradient-* class name
 *  - current/previous: numbers for trend delta (optional)
 *  - invert: true if lower is better (costs, incidents)
 *  - onClick: () => void — opens drill-down drawer
 */
export default function KpiTile({ label, value = 0, format = 'number', icon: Icon, gradient = 'stat-gradient-emerald', current, previous, invert = false, onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`${gradient} rounded-2xl p-3 sm:p-4 text-white relative overflow-hidden min-w-0 text-left transition-shadow hover:shadow-lg ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
        {Icon && <Icon className="w-12 h-12 sm:w-16 sm:h-16" />}
      </div>
      <div className="relative">
        <div className="flex items-start justify-between">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 sm:mb-2 opacity-80" />}
          {current != null && previous != null && (
            <TrendDelta current={current} previous={previous} invert={invert} />
          )}
        </div>
        <p className="text-ui-micro font-bold uppercase tracking-wide opacity-80 leading-tight mt-1">{label}</p>
        <p className="text-ui-kpi font-extrabold mt-0.5 truncate">
          <AnimatedCounter value={value} format={format} />
        </p>
      </div>
    </motion.button>
  );
}