import React from 'react';
import { MapPin } from 'lucide-react';

/**
 * What3WordsPill — compact, green-tinted pill displaying a what3words address.
 * Clicks through to what3words.com for the full map view.
 *
 * Props:
 *   value: the what3words string (e.g. 'filled.count.soap')
 *   size: 'sm' (card) or 'md' (detail view)
 *   showLabel: if true, shows a "w3w" label prefix
 */
export default function What3WordsPill({ value, size = 'sm', showLabel = false }) {
  if (!value || !String(value).trim()) return null;
  const w3w = String(value).trim().toLowerCase();
  const url = `https://what3words.com/${w3w.replace(/\s+/g, '.')}`;
  const sizeCls = size === 'sm'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`what3words: ${w3w} — click to open map`}
      className={`inline-flex items-center rounded-full font-mono font-semibold bg-primary/8 text-primary hover:bg-primary/15 transition border border-primary/15 ${sizeCls}`}
    >
      <MapPin className="w-3 h-3 flex-shrink-0" />
      {showLabel && <span className="opacity-60 uppercase text-[9px] font-bold tracking-wide">w3w</span>}
      <span className="truncate">{w3w}</span>
    </a>
  );
}