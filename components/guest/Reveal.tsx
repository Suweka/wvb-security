'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  /** Delay in seconds before the animation starts */
  delay?: number;
  /** Direction the element slides in from */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

/** Fades + slides content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, direction = 'up', className }: RevealProps) {
  // Respects the OS-level "reduce motion" accessibility setting — skips the
  // slide/fade animation for users who've asked for less motion.
  const reduce = useReducedMotion();

  const offset = 32;
  // Starting position offset (in pixels) based on which direction the content
  // should appear to slide in from. 'none' means no offset at all.
  const from = {
    up:    { y: offset },
    down:  { y: -offset },
    left:  { x: offset },
    right: { x: -offset },
    none:  {},
  }[direction];

  return (
    <motion.div
      className={className}
      // If reduced motion is preferred, start fully visible; otherwise start
      // invisible and offset in the chosen direction.
      initial={reduce ? { opacity: 1 } : { opacity: 0, ...from }}
      // whileInView + viewport={once:true} animates to this state the first
      // (and only) time the element scrolls into the viewport.
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds between each child's entrance */
  interval?: number;
}

/** Container that reveals its direct children one after another. */
export function Stagger({ children, className, interval = 0.1 }: StaggerProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      // "variants" let a parent and its children share named animation
      // states ('hidden'/'visible'); the parent switching state cascades
      // down to children that reference the same variant names.
      initial={reduce ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        // staggerChildren delays each child's animation by `interval`
        // seconds relative to the previous one, creating a cascade effect.
        visible: { transition: { staggerChildren: interval } },
      }}
    >
      {/* React.Children.map safely iterates over `children`, wrapping each
          one in its own animated div even if there's only a single child. */}
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 28 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] } },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
