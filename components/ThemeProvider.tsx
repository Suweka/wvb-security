// Provides light/dark theme state to the whole app via React Context, and
// keeps it in sync with localStorage (so the choice persists across visits)
// and with the <html> element's "dark" class (which Tailwind's dark: variant
// looks for).
'use client';

// React Context lets a value (like the current theme) be read by any
// descendant component without passing it down as a prop through every
// level in between. createContext defines the "channel", useContext reads
// from it, and a <Context.Provider> supplies the value.
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

// The context object itself. `undefined` default means "no provider found" —
// used below to throw a helpful error if useTheme() is called outside <ThemeProvider>.
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // useState holds the current theme in component state; setTheme updates it
  // and triggers a re-render. Starts as 'light' until we know better (see effect below).
  const [theme, setTheme] = useState<Theme>('light');

  // Runs once on mount (empty dependency array [] = "only run after first render").
  // Reads any previously saved theme from localStorage, or falls back to the
  // user's OS-level dark mode preference, and applies it.
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const initial = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
  }, []);

  // Runs every time `theme` changes. Toggles the "dark" class on <html>
  // (which is what makes Tailwind's dark: classes take effect) and saves
  // the choice to localStorage so it survives a page reload.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Flips between 'light' and 'dark'. Uses the updater-function form of
  // setState so it always reads the latest theme value.
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Convenience hook for any component that needs the current theme or the
// toggle function. Throws if used outside a <ThemeProvider>, which makes
// misuse easy to spot during development.
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
