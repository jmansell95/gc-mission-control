import React from 'react';

/**
 * AuditScoreGauge — circular SVG ring showing audit score percentage.
 * Green for pass (>=80%), amber for partial (50-79%), red for fail (<50%).
 * Animated stroke-dashoffset draws the ring on mount.
 */
export default function AuditScoreGauge({ percentage, passFail = 'pending', size = 120 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = percentage != null ? Math.max(0, Math.min(100, Math.round(percentage))) : null;
  const offset = pct != null ? circumference - (pct / 100) * circumference : circumference;

  // Colour based on pass/fail or percentage
  const color = passFail === 'fail' ? '#e11d48'
    : passFail === 'pass' ? '#059669'
    : pct == null ? '#94a3b8'
    : pct >= 80 ? '#059669'
    : pct >= 50 ? '#f59e0b'
    : '#e11d48';

  const bgRing = '#f1f5f9';

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgRing} strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color }}>
          {pct != null ? `${pct}%` : '—'}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Score</span>
      </div>
    </div>
  );
}