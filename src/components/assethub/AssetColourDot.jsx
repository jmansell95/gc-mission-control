import React from 'react';

/**
 * Maps a free-text colour name to a hex value for a visual swatch.
 * Used on asset cards and the detail hero so managers can distinguish
 * similar equipment at a glance (e.g. "Blue Rig" vs "Red Rig").
 */
const COLOUR_MAP = {
  red: '#ef4444', crimson: '#dc143c', scarlet: '#ff2400',
  blue: '#3b82f6', navy: '#1e3a8a', sky: '#0ea5e9', azure: '#007fff', royal: '#4169e1',
  green: '#22c55e', darkgreen: '#166534', olive: '#808000', lime: '#84cc16',
  yellow: '#eab308', gold: '#d4af37', amber: '#f59e0b',
  orange: '#f97316', rust: '#b7410e', terracotta: '#e2725b',
  purple: '#a855f7', violet: '#8b5cf6', magenta: '#d946ef', mauve: '#e0b0ff',
  pink: '#ec4899', rose: '#f43f5e',
  white: '#f8fafc', cream: '#fffdd0', ivory: '#fffff0',
  black: '#1e293b', charcoal: '#36454f', grey: '#6b7280', gray: '#6b7280', slate: '#64748b', silver: '#c0c0c0',
  brown: '#92400e', tan: '#d2b48c', beige: '#e8d8b0',
  turquoise: '#14b8a6', teal: '#14b8a6', cyan: '#06b6d4',
};

/**
 * Resolve a colour string to a hex value. Tries exact match, then
 * substring match, then falls back to a neutral slate.
 */
export function resolveColourHex(colour) {
  if (!colour) return null;
  const c = String(colour).toLowerCase().trim();
  if (COLOUR_MAP[c]) return COLOUR_MAP[c];
  for (const key of Object.keys(COLOUR_MAP)) {
    if (c.includes(key)) return COLOUR_MAP[key];
  }
  return '#94a3b8'; // neutral fallback
}

/**
 * A small circular colour swatch. Shows a ring border so light colours
 * (white, cream) are still visible against a light card background.
 */
export default function AssetColourDot({ colour, size = 14, className = '' }) {
  const hex = resolveColourHex(colour);
  if (!hex) return null;
  return (
    <span
      className={`inline-block rounded-full border border-slate-300/60 flex-shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: hex }}
      title={colour ? `Colour: ${colour}` : ''}
    />
  );
}