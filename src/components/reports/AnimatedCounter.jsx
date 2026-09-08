import React, { useEffect, useRef, useState } from 'react';

/**
 * AnimatedCounter — counts up from 0 to the target value on mount with a
 * smooth ease-out curve. Supports currency (£), plain number, and
 * percentage formats. Reused by every KPI tile across all reports.
 */
export default function AnimatedCounter({ value = 0, format = 'number', duration = 900, className = '' }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const target = Number(value) || 0;

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else setDisplay(target);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  const fmt = () => {
    if (format === 'currency') return '£' + Math.round(display).toLocaleString('en-GB');
    if (format === 'percentage') return Math.round(display) + '%';
    return Math.round(display).toLocaleString('en-GB');
  };

  return <span className={`tabular-nums ${className}`}>{fmt()}</span>;
}