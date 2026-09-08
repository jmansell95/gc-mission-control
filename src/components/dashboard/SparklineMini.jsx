import React from 'react';

/**
 * SparklineMini — tiny inline SVG sparkline for 7-day trends.
 * Renders nothing if fewer than 2 data points so widgets don't show
 * a broken line for empty data.
 *
 * Props:
 *   data   — array of numbers (chronological order)
 *   color  — stroke/fill color (hex)
 *   width  — svg width (default 100)
 *   height — svg height (default 28)
 */
export default function SparklineMini({ data = [], color = '#10b981', width = 100, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (height - ((v - min) / range) * (height - 4) - 2).toFixed(1);
    return `${x},${y}`;
  });
  const linePath = `M ${pts.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible flex-shrink-0">
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}