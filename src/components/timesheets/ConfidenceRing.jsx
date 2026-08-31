import React from 'react';

const TIER_COLORS = {
  green: { stroke: '#10b981', bg: '#ecfdf5' },
  review: { stroke: '#f59e0b', bg: '#fffbeb' },
  missing: { stroke: '#f43f5e', bg: '#fff1f2' },
  none: { stroke: '#e2e8f0', bg: '#f8fafc' },
};

export function getTier(score) {
  if (score == null) return 'none';
  if (score >= 80) return 'green';
  if (score >= 40) return 'review';
  return 'missing';
}

/**
 * Circular confidence ring with an avatar/initial in the centre.
 * score: 0-100 (null = no auto-build data → grey ring)
 */
export default function ConfidenceRing({ score, size = 44, children }) {
  const tier = getTier(score);
  const { stroke, bg } = TIER_COLORS[tier];
  const strokeW = 3;
  const radius = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score || 0));
  const dash = (pct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeW} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        )}
      </svg>
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{ width: size - strokeW * 2 - 4, height: size - strokeW * 2 - 4, background: bg }}
      >
        {children}
      </div>
    </div>
  );
}