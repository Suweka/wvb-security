'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  /** Final value to count to */
  end: number;
  /** Text after the number, e.g. "+" or "★" */
  suffix?: string;
  /** Animation length in ms */
  duration?: number;
  /** Show one decimal place (for ratings like 4.9) */
  decimals?: number;
  className?: string;
}

/** Animates a number from 0 to `end` the first time it scrolls into view. */
export function CountUp({ end, suffix = '', duration = 1800, decimals = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setValue(end); return; }

    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic — fast start, gentle landing
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}{suffix}
    </span>
  );
}
