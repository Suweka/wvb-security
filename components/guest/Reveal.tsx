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
  const reduce = useReducedMotion();

  const offset = 32;
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
      initial={reduce ? { opacity: 1 } : { opacity: 0, ...from }}
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
      initial={reduce ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: interval } },
      }}
    >
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
