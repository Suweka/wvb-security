'use client';

// useRef is not used here, but useEffect (side effects) and useState (component
// state) are — see notes below.
import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
// framer-motion: an animation library. `motion.button` is a normal <button>
// that also understands the initial/animate/exit animation props below.
// AnimatePresence lets components animate OUT (fade/slide away) when they're
// removed from the tree, which a plain `{visible && <button/>}` can't do.
import { AnimatePresence, motion } from 'framer-motion';

/** Floating back-to-top button; appears after scrolling down a screen. */
export function BackToTop() {
  // Tracks whether the button should currently be shown.
  const [visible, setVisible] = useState(false);

  // Runs once on mount. Adds a scroll listener that shows the button once
  // the user has scrolled down more than 80% of the viewport height, and
  // removes the listener when the component unmounts (the returned cleanup
  // function).
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll(); // run once immediately in case the page loads already scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    // AnimatePresence watches its children; when `visible` becomes false and
    // the button is removed, it plays the `exit` animation first instead of
    // just vanishing instantly.
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 12 }}
          transition={{ duration: 0.25 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 left-6 z-40 w-11 h-11 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark hover:shadow-xl transition-colors"
        >
          <ArrowUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
