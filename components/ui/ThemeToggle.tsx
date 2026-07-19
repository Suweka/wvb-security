// Small round button that switches the site between light and dark mode,
// showing a sun or moon icon depending on the current theme, with a rotating
// swap animation between the two icons.
'use client'; // Reads/toggles theme state and plays animations, so it runs client-side.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

// Renders the toggle button. Actual theme state (and how it's persisted) lives
// in ThemeProvider — this component just reads it and calls toggleTheme() on click.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      // aria-label/title describe the *action* (what clicking will do), not the
      // current state, which is the standard accessibility pattern for toggles.
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative w-10 h-10 rounded-full glass-card flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ${className}`}
    >
      {/* AnimatePresence with mode="wait" makes the old icon finish its exit
          animation before the new one plays its enter animation, instead of
          both overlapping. initial={false} skips the animation on first render. */}
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute"
          >
            <Moon size={18} className="text-primary-light" />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute"
          >
            <Sun size={18} className="text-accent" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
