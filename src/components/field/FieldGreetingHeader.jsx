import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useFieldData } from '@/components/field/FieldDataProvider';

/**
 * FieldGreetingHeader — THE single shared header for every field page.
 *
 * Renders the personalised greeting (avatar + Morning/Afternoon/Evening +
 * staff name + day/date), optional page-specific stat tiles, optional
 * action icons, and optional children (search/filters) inside a single
 * dark-green gradient card.
 *
 * No back button — navigation is via the bottom nav bar or swipe gesture.
 */
export default function FieldGreetingHeader({ staff, stats = [], actions, accentColor, children }) {
  const ctx = useFieldData();
  const person = staff || ctx?.staff;

  if (!person) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="hero-vibrant rounded-3xl mx-4 sm:mx-6 mt-4 p-5 text-white relative overflow-hidden"
    >
      {accentColor && (
        <div className="h-1 w-full absolute top-0 left-0 right-0 rounded-t-3xl" style={{ background: accentColor }} />
      )}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 blur-lg pointer-events-none" />

      <div className="relative flex items-center gap-3">
        {person.avatar_url ? (
          <img src={person.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/30 shadow-md flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
            {(person.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-ui-caption text-white/70 font-medium">{greeting}</p>
          <h1 className="text-ui-heading font-bold text-white truncate">{person.name || 'Field Crew'}</h1>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-ui-caption text-white/60">{format(new Date(), 'EEEE')}</p>
          <p className="text-sm font-bold text-white/90">{format(new Date(), 'dd MMM')}</p>
        </div>
        {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
      </div>

      {stats.length > 0 && (
        <div className="relative grid gap-2.5 mt-3" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))` }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className={`${stat.gradient} rounded-2xl p-2.5 text-white relative overflow-hidden`}>
                {Icon && <Icon className="w-3.5 h-3.5 text-white/40 absolute top-2 right-2" />}
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">{stat.label}</p>
                <p className="text-base font-extrabold mt-0.5 tabular-nums truncate">{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {children && <div className="relative mt-3 space-y-2.5">{children}</div>}
    </motion.div>
  );
}