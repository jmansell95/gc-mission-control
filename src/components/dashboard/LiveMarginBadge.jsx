import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * LiveMarginBadge — shows a live margin badge on job cards.
 * Green ≥15%, amber 5–15%, rose <5%.
 * Computed from the latest financial rollup.
 */
export default function LiveMarginBadge({ job, financials, onClick, size = 'sm' }) {
  // Calculate margin from financials or job fields
  let marginPct = null;
  let revenue = 0;
  let cost = 0;

  if (financials) {
    revenue = Number(financials.total_revenue || financials.revenue || 0);
    cost = Number(financials.total_cost || financials.cost || 0);
    if (revenue > 0) {
      marginPct = ((revenue - cost) / revenue) * 100;
    }
  } else if (job) {
    revenue = Number(job.total_revenue || job.revenue || 0);
    cost = Number(job.total_cost || job.cost || 0);
    if (revenue > 0) {
      marginPct = ((revenue - cost) / revenue) * 100;
    }
  }

  // No data
  if (marginPct === null) {
    return (
      <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200`}>
        <Minus className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        No margin data
      </span>
    );
  }

  const isHealthy = marginPct >= 15;
  const isWarning = marginPct >= 5 && marginPct < 15;
  const isCritical = marginPct < 5;

  const config = isHealthy
    ? { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: TrendingUp, label: `${marginPct.toFixed(1)}%` }
    : isWarning
    ? { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: TrendingDown, label: `${marginPct.toFixed(1)}%` }
    : { cls: 'bg-rose-50 text-rose-700 ring-rose-200', icon: TrendingDown, label: `${marginPct.toFixed(1)}%` };

  const Icon = config.icon;

  const badge = (
    <span
      className={`inline-flex items-center gap-1 ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold rounded-full ring-1 ${config.cls} ${onClick ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
    >
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {config.label}
    </span>
  );

  if (onClick) {
    return <button type="button" onClick={onClick} className="inline-block">{badge}</button>;
  }
  return badge;
}