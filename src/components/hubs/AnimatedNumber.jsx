import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber — counts up from 0 to the target value on mount (or when
 * the value changes). Uses requestAnimationFrame with an ease-out curve for
 * a smooth, premium feel. Renders plain text when the value isn't a number.
 *
 * Props:
 *   value    — the target number (or string — non-numbers render as-is)
 *   duration — animation duration in ms (default 800)
 *   format   — optional function(value) => string for custom formatting
 */
export default function AnimatedNumber({ value, duration = 800, format }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const isNumber = !isNaN(numValue) && isFinite(numValue);

  useEffect(() => {
    if (!isNumber) return;
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(numValue * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(numValue);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [numValue, duration, isNumber]);

  if (!isNumber) return <>{value}</>;
  const formatted = format ? format(display) : Math.round(display).toLocaleString('en-GB');
  return <>{formatted}</>;
}