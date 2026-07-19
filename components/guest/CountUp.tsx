'use client';

// useRef gives a mutable "box" that persists across re-renders without
// causing a re-render itself when it changes — used here to grab a reference
// to the actual DOM <span> element so useInView can watch it.
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
  // ref is attached to the <span> below so useInView can detect when it
  // scrolls into the viewport.
  const ref = useRef<HTMLSpanElement>(null);
  // true once, the first time the element enters the viewport (`once: true`
  // means it won't flip back to false if the user scrolls away).
  const inView = useInView(ref, { once: true, margin: '-40px' });
  // Respects the OS-level "reduce motion" accessibility setting.
  const reduce = useReducedMotion();
  // The number currently displayed, updated on every animation frame.
  const [value, setValue] = useState(0);

  // Runs whenever inView/end/duration/reduce change. Once the element is in
  // view, animates `value` from 0 up to `end` using requestAnimationFrame
  // (the browser API for smooth, frame-synced animations).
  useEffect(() => {
    if (!inView) return;
    // If the user prefers reduced motion, skip the animation and jump straight
    // to the final value.
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
    // Cleanup: if the component unmounts mid-animation, cancel the pending frame.
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}{suffix}
    </span>
  );
}
