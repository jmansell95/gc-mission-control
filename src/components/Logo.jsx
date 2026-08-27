import React from 'react';
import { Waves } from 'lucide-react';

/**
 * Brand logos for the Ground Control enterprise platform.
 *
 * Hierarchy:
 *  - Ground Control (ultimate parent company) — Logo / LogoFull
 *  - Land & Water Solutions (group inside Ground Control) — LandWaterLogo
 *  - Divisions (Geotechnical SI, etc.) — division cards
 */

// Ground Control original logo — transparent background full lockup
const EMBLEM_URL = 'https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png';

export { EMBLEM_URL };

/**
 * Ground Control logo — the original full lockup, transparent background.
 */
export default function Logo({ height = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ height, width: 'auto' }}
      className={'object-contain flex-shrink-0 ' + className}
    />
  );
}

export function LogoMark({ size = 36, className = '' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ width: size, height: 'auto' }}
      className={'object-contain flex-shrink-0 ' + className}
    />
  );
}

/**
 * Ground Control full lockup — same image as Logo (the original already
 * contains the wordmark). Kept for API compatibility with callers that
 * pass tone/variant props.
 */
export function LogoFull({ height = 36, className = '', tone = 'light' }) {
  return (
    <img
      src={EMBLEM_URL}
      alt="Ground Control"
      style={{ height, width: 'auto' }}
      className={'object-contain flex-shrink-0 ' + className}
    />
  );
}

/**
 * Land & Water Solutions group brand — a CSS emblem (gradient badge with
 * waves icon) + wordmark. No external image needed.
 */
export function LandWaterLogo({ height = 36, className = '', tone = 'light', showText = true }) {
  const textColor = tone === 'light' ? 'text-white' : 'text-slate-900';
  const subColor = tone === 'light' ? 'text-white/60' : 'text-slate-500';
  return (
    <div className={'flex items-center gap-2.5 ' + className}>
      <div
        className="rounded-xl bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md"
        style={{ width: height, height: height }}
      >
        <Waves className="text-white" style={{ width: Math.round(height * 0.55), height: Math.round(height * 0.55) }} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={'font-extrabold tracking-tight ' + textColor} style={{ fontSize: Math.round(height * 0.42) }}>
            Land &amp; Water
          </span>
          <span className={'font-medium tracking-[0.18em] uppercase ' + subColor} style={{ fontSize: Math.round(height * 0.28) }}>
            Solutions
          </span>
        </div>
      )}
    </div>
  );
}