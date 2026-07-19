// A custom-styled dropdown that replaces the native <select> element, so it can
// be themed (glass effect, animations, dark mode) consistently with the rest of
// the site instead of using the browser's plain default dropdown.
'use client'; // Needs state, refs and DOM event listeners, so it's a client component.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

// Shape of a single dropdown option: the underlying value and its display text.
export interface StyledSelectOption {
  value: string;
  label: string;
}

interface StyledSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: StyledSelectOption[];
  className?: string;
}

// Renders a button showing the currently selected label; clicking it opens an
// animated list of options (AnimatePresence handles the open/close animation).
export function StyledSelect({ value, onChange, options, className }: StyledSelectProps) {
  const [open, setOpen] = useState(false); // whether the options list is visible
  const ref = useRef<HTMLDivElement>(null); // wrapping div, used to detect outside clicks
  const selected = options.find(o => o.value === value);

  // Close the dropdown when the user clicks outside it, or presses Escape.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    // Cleanup: remove both listeners when the component unmounts.
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []); // run once on mount

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {/* The closed-state button. aria-haspopup/aria-expanded tell screen readers
          this button controls a listbox, matching the native <select> semantics. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        {/* Chevron flips upside-down while open, as a visual open/closed indicator */}
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* AnimatePresence lets the <motion.ul> play an exit animation before being
          removed from the DOM, instead of just disappearing instantly. */}
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 mt-2 glass-strong rounded-xl shadow-xl overflow-hidden z-50 py-1"
          >
            {/* One row per option; clicking selects it and closes the dropdown */}
            {options.map(o => {
              const isSelected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary-light text-primary font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-primary-light/60 hover:text-primary'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {/* Checkmark shown only next to the currently selected option */}
                    {isSelected && <Check size={14} className="flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
