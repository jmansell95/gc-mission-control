import React from 'react';

/**
 * Reusable KPI stats bar for hub pages.
 * Renders a responsive grid of insight-card tiles with icon, label, value, and optional sublabel.
 *
 * Props:
 *  - tiles: [{ icon, label, value, sublabel, color, onClick }]
 *    - color: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate' | 'teal' | 'brand'
 *    - onClick: optional click handler (makes the tile interactive)
 */
const COLOR_MAP = {
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', value: 'text-slate-900' },
  blue: { iconBg: 'bg-blue-50', iconText: 'text-blue-600', value: 'text-slate-900' },
  amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-600', value: 'text-slate-900' },
  rose: { iconBg: 'bg-rose-50', iconText: 'text-rose-600', value: 'text-slate-900' },
  violet: { iconBg: 'bg-violet-50', iconText: 'text-violet-600', value: 'text-slate-900' },
  slate: { iconBg: 'bg-slate-100', iconText: 'text-slate-500', value: 'text-slate-900' },
  teal: { iconBg: 'bg-teal-50', iconText: 'text-teal-600', value: 'text-slate-900' },
  brand: { iconBg: 'bg-[#2E5A1A]/10', iconText: 'text-[#2E5A1A]', value: 'text-slate-900' },
};

export default function HubStatsBar({ tiles = [], columns }) {
  if (!tiles.length) return null;
  // Use literal class strings so Tailwind's purge keeps them
  const colClass = tiles.length <= 2
    ? 'grid-cols-2'
    : tiles.length === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : tiles.length === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : tiles.length === 5
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  return (
    <div className={`grid ${colClass} gap-2.5`}>
      {tiles.map((tile, i) => {
        const c = COLOR_MAP[tile.color] || COLOR_MAP.slate;
        const Icon = tile.icon;
        const Wrapper = tile.onClick ? 'button' : 'div';
        return (
          <Wrapper
            key={i}
            onClick={tile.onClick}
            className={`insight-card rounded-hub p-hub-card-pad-sm text-left transition ${tile.onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {Icon && (
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
                  <Icon className={`w-3.5 h-3.5 ${c.iconText}`} />
                </div>
              )}
              <p className="text-hub-caption text-slate-500 font-medium uppercase tracking-wide truncate">{tile.label}</p>
            </div>
            <p className={`text-hub-title font-bold tabular-nums ${c.value} truncate`}>{tile.value}</p>
            {tile.sublabel && <p className="text-hub-caption text-slate-400 mt-0.5 truncate">{tile.sublabel}</p>}
          </Wrapper>
        );
      })}
    </div>
  );
}