import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';

/**
 * FieldPageShell — unified mobile/tablet layout for all field-facing pages.
 * Upgraded with an animated gradient header (hero-gradient) for the playful
 * & bold design system. All text is white on the gradient; search and filter
 * pills are inverted for contrast. Preserves all existing functionality
 * (back button, actions, search, filters, fixed header, accent strip).
 */
export default function FieldPageShell({
  title,
  subtitle,
  icon: Icon,
  onBack,
  actions,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  children,
  contentClassName = '',
  headerTone = 'light',
  accentColor,
  fixedHeader = false,
  meta,
  transparent = false,
}) {
  return (
    <div className={transparent ? "min-h-0" : "min-h-screen page-bg-vibrant"}>
      {/* Header — animated gradient bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={(fixedHeader ? "fixed top-0 left-0 right-0 " : "sticky top-0 ") + "z-30 hero-gradient safe-area-top relative overflow-hidden"}
      >
        {/* Decorative blurred circles */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 blur-lg pointer-events-none" />

        {/* Division accent strip */}
        {accentColor && (
          <div className="h-1 w-full flex-shrink-0 relative" style={{ background: accentColor }} />
        )}

        <div className="relative flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition flex-shrink-0 active:scale-95 touch-manipulation">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {Icon && (
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0"
              >
                <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </motion.div>
            )}
            <div className="min-w-0">
              <h1 className="text-hub-title text-white truncate leading-tight">{title}</h1>
              {subtitle && (
                <div className="flex flex-col sm:flex-row sm:gap-1.5 leading-tight mt-0.5 min-w-0">
                  <span className="text-hub-caption text-white/80 font-bold truncate">{subtitle}</span>
                  {meta && <span className="text-hub-caption text-white/60 font-bold tabular-nums sm:flex-shrink-0">{meta}</span>}
                </div>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
        </div>

        {/* Search bar */}
        {onSearchChange && (
          <div className="relative px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                value={search || ''}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/20 border border-white/20 text-hub-body text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
          </div>
        )}

        {/* Horizontal filter pills */}
        {filters && filters.length > 0 && (
          <div className="relative px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map(f => {
              const active = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterChange(f.key)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-hub-body font-semibold transition active:scale-95 ${
                    active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'bg-white/10 text-white/80 border border-white/20'
                  }`}
                >
                  {f.label}
                  {f.count != null && (
                    <span className={`ml-1.5 text-xs ${active ? 'opacity-80' : 'text-white/50'}`}>{f.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Content */}
      <div className={contentClassName} style={fixedHeader ? { paddingTop: 'calc(3.75rem + env(safe-area-inset-top, 0px))' } : undefined}>
        {children}
      </div>
    </div>
  );
}