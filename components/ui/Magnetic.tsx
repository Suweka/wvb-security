// A small wrapper component that adds a "magnetic" hover effect: whatever is
// passed as `children` (usually a button) visually drifts a little toward the
// mouse cursor while hovered, then springs back when the mouse leaves.
'use client'; // Uses mouse events and animation hooks, so it must run in the browser.

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  /** How strongly the element follows the cursor (0-1) */
  strength?: number;
}

/** Wraps a button/element so it gently pulls toward the cursor when nearby. */
export function Magnetic({ children, className, strength = 0.35 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Respects the OS-level "reduce motion" accessibility setting — if the user
  // has that on, we skip the animation entirely instead of forcing movement.
  const reduce = useReducedMotion();
  // useMotionValue: a Framer Motion value that can be animated outside of React's
  // normal re-render cycle (fast, GPU-friendly). x/y are the current offset.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // useSpring wraps a motion value so changes to it animate smoothly (like a
  // physical spring) instead of jumping instantly. stiffness/damping/mass tune the "feel".
  const springX = useSpring(x, { stiffness: 200, damping: 15, mass: 0.3 });
  const springY = useSpring(y, { stiffness: 200, damping: 15, mass: 0.3 });

  // As the mouse moves over the element, offset x/y by the cursor's distance
  // from the element's center, scaled down by `strength` so it's a subtle pull.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }

  // Reset back to center once the cursor leaves — the spring animates this smoothly.
  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      // Skip applying the animated offset entirely when reduced motion is preferred.
      style={reduce ? undefined : { x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
