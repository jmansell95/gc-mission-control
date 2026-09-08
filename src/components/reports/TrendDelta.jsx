import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * TrendDelta — renders a green-up / red-down / flat badge showing the %
 * change vs the previous equivalent period. Pass current and previous
 * numeric totals; the badge computes the delta automatically.
 */
export default function TrendDelta({ current = 0, previous = 0, invert = false, className = '' }) {
  if (!previous && !current) return null;

  let deltaPct = 0;
  if (previous > 0) {
    deltaPct = ((current - previous) / previous) * 100;
  } else if (current > 0) {
    deltaPct = 100; // went from zero to something
  }

  const isUp = deltaPct > 0.5;
  const isDown = deltaPct < -0.5;
  // invert=true means a decrease is good (e.g. costs, incidents)
  const good = invert ? isDown : isUp;
  const bad = invert ? isUp : isDown;

  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const color = good ? 'bg-emerald-500/30 text-emerald-50' : bad ? 'bg-rose-500/30 text-rose-50' : 'bg-white/20 text-white/80';
  const sign = isUp ? '+' : isDown ? '' : '';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${color} ${className}`}>
      <Icon className="w-2.5 h-2.5" />
      {sign}{Math.round(Math.abs(deltaPct))}%
    </span>
  );
}