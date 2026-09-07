import React from 'react';
import StatPill from '@/components/hubs/StatPill';

/**
 * HubStatsBar — responsive KPI strip for hub pages.
 * Now a thin layout wrapper around the shared StatPill primitive so every hub
 * (and the Command Centre) renders identical KPI tiles.
 *
 * Props:
 *  - tiles: [{ icon, label, value, sublabel, color, onClick, active, delta }]
 */
export default function HubStatsBar({ tiles = [] }) {
  if (!tiles.length) return null;

  // Literal class strings so Tailwind's purge keeps them
  const colClass = tiles.length <= 2
    ? 'grid-cols-2'
    : tiles.length === 3
      ? 'grid-cols-3'
      : tiles.length === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : tiles.length === 5
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6';

  return (
    <div className={`grid ${colClass} gap-2 sm:gap-2.5`}>
      {tiles.map((tile, i) => (
        <StatPill key={i} index={i} {...tile} />
      ))}
    </div>
  );
}