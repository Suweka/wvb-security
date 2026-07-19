// This is the public Photo Gallery page. It shows a filterable grid of hard-coded
// images (by category) and a full-screen "lightbox" viewer with keyboard navigation
// when a photo is clicked. No API calls — all image data is defined in the IMAGES array below.

// 'use client' — required because this page uses React state (filters, lightbox),
// keyboard event listeners, and framer-motion animations, all of which need the browser.
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Expand, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/guest/Reveal';

// The set of category filter values a photo can belong to ('all' is a special
// virtual category meaning "show everything", not a real photo tag).
type Category = 'all' | 'rooms' | 'facilities' | 'location' | 'food';

interface GalleryImage {
  id: number;
  category: Category | string;
  title: string;
  src: string;
}

// Category filter buttons shown at the top of the gallery, in display order.
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All Photos' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'location', label: 'Location' },
  { id: 'food', label: 'Food & Dining' },
];

// Full list of gallery photos, each tagged with a category so it can be filtered.
const IMAGES: GalleryImage[] = [
  // Rooms
  { id: 1, category: 'rooms', title: 'Deluxe Room', src: '/images/rooms/deluxe.jpeg' },
  { id: 2, category: 'rooms', title: 'Junior Suite', src: '/images/rooms/suite.jpeg' },
  { id: 3, category: 'rooms', title: 'Family Room', src: '/images/rooms/family.jpeg' },
  { id: 13, category: 'rooms', title: 'Bathroom', src: '/images/rooms/junior.jpeg' },
  { id: 14, category: 'rooms', title: 'Living Area', src: '/images/rooms/executive.jpeg' },

  // Facilities
  { id: 4, category: 'facilities', title: 'Kitchen', src: '/images/kitchen.jpeg' },
  { id: 5, category: 'facilities', title: 'Living Area', src: '/images/living-area.jpeg' },
  { id: 6, category: 'facilities', title: 'Living Area', src: '/images/living-area2.jpeg' },
  { id: 15, category: 'facilities', title: 'Dining Area', src: '/images/dining-area.jpeg' },
  { id: 18, category: 'facilities', title: 'Garden', src: '/images/location5.jpeg' },

  // Location
  { id: 7, category: 'location', title: 'Tea Plantation View', src: '/images/location1.jpeg' },
  { id: 8, category: 'location', title: 'Mountain Scenery', src: '/images/location2.jpeg' },
  { id: 9, category: 'location', title: 'Garden Area', src: '/images/location3.jpeg' },
  { id: 16, category: 'location', title: 'Exterior View', src: '/images/location4.jpeg' },
  { id: 20, category: 'location', title: 'Exterior View', src: '/images/location6.jpeg' },

  // Food & Dining
  { id: 10, category: 'food', title: 'Garden', src: '/images/food1.jpeg' },
  { id: 11, category: 'food', title: 'Breakfast Buffet', src: '/images/food2.jpeg' },
  { id: 12, category: 'food', title: 'Fine Dining', src: '/images/food3.jpeg' },
  { id: 17, category: 'food', title: 'Bar Area', src: '/images/food4.jpeg' },
];

export default function GalleryPage() {
  // Which category filter is currently selected.
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  // Index (within filteredImages) of the photo currently shown in the lightbox.
  // null means the lightbox is closed.
  const [lightboxImage, setLightboxImage] = useState<number | null>(null);
  // Which way the lightbox is animating: 1 = moving to next photo, -1 = previous,
  // 0 = just opened (no slide direction). Used to animate the slide transition.
  const [direction, setDirection] = useState(0);

  // useMemo caches this calculation so it isn't redone on every render — here it only
  // needs computing once (the empty [] dependency array means "never recompute").
  // Builds a lookup of how many photos exist per category, e.g. { all: 19, rooms: 5, ... },
  // used to show the count next to each filter button.
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: IMAGES.length };
    for (const img of IMAGES) map[img.category] = (map[img.category] ?? 0) + 1;
    return map;
  }, []);

  // The photos to actually display: everything if "all" is selected, otherwise only
  // photos matching the active category. Recalculated on every render.
  const filteredImages = activeCategory === 'all'
    ? IMAGES
    : IMAGES.filter(img => img.category === activeCategory);

  // Opens the lightbox on the photo at the given index within filteredImages.
  const openLightbox = (index: number) => {
    setDirection(0);
    setLightboxImage(index);
  };

  const closeLightbox = () => setLightboxImage(null);

  // Advances to the next photo, wrapping around to the first photo after the last
  // (the % modulo makes the index "wrap" instead of going out of bounds).
  const nextImage = () => {
    setDirection(1);
    setLightboxImage(prev => prev === null ? null : (prev + 1) % filteredImages.length);
  };

  // Goes back to the previous photo, wrapping around to the last photo if currently
  // on the first one.
  const prevImage = () => {
    setDirection(-1);
    setLightboxImage(prev => prev === null ? null : (prev - 1 + filteredImages.length) % filteredImages.length);
  };

  // useEffect runs this code after the component renders, and re-runs whenever any
  // value in the dependency array (the [] at the end) changes. Here it's used to
  // attach a keyboard listener while the lightbox is open, and clean it up (the
  // returned function) when the lightbox closes or the component unmounts —
  // this avoids leaking event listeners.
  useEffect(() => {
    if (lightboxImage === null) return; // don't listen for keys when lightbox is closed
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxImage, filteredImages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fadeIn">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-primary to-primary-dark text-white py-20 px-4">
        <div className="absolute top-10 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-accent/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="container mx-auto text-center relative"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles size={14} className="text-accent" />
            {IMAGES.length} Photos
          </div>
          <h1 className="text-5xl font-heading font-bold mb-4">Our Gallery</h1>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto">
            Explore the beauty of White Vintage Bungalow through our photo collection
          </p>
        </motion.div>
      </section>

      {/* Category Filters */}
      <section className="glass-strong sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto py-4 gap-2 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="relative px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors"
              >
                {activeCategory === cat.id && (
                  <motion.span
                    layoutId="activeCategoryPill"
                    className="absolute inset-0 bg-primary rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={activeCategory === cat.id ? 'text-white' : 'text-gray-700 dark:text-gray-300 hover:text-primary'}>
                  {cat.label} <span className="opacity-70">({counts[cat.id] ?? 0})</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="mb-6">
          <h2 className="text-2xl font-heading font-semibold flex items-center gap-2">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={filteredImages.length}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                {filteredImages.length}
              </motion.span>
            </AnimatePresence>
            Photo{filteredImages.length !== 1 ? 's' : ''}
          </h2>
        </div>

        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredImages.map((image, index) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                whileHover={{ y: -4 }}
                onClick={() => openLightbox(index)}
                className="relative isolate aspect-square overflow-hidden rounded-2xl cursor-pointer group shadow-md hover:shadow-xl transition-shadow"
              >
                <img
                  src={image.src}
                  alt={image.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Expand className="text-white" size={28} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  <p className="font-semibold">{image.title}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredImages.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No images found in this category</p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-primary to-primary-dark text-white py-16 px-4">
        <div className="absolute -top-16 left-1/3 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <Reveal className="container mx-auto text-center relative">
          <h2 className="text-3xl font-heading font-bold mb-4">Experience It In Person</h2>
          <p className="text-gray-200 mb-6 max-w-2xl mx-auto">
            Book your stay and discover the charm of our vintage bungalow
          </p>
          <Link href="/booking">
            <Button variant="secondary" size="lg">
              Book Your Stay
            </Button>
          </Link>
        </Reveal>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <X size={32} />
            </button>

            <button
              onClick={prevImage}
              className="absolute left-4 text-white hover:text-gray-300 z-10"
            >
              <ChevronLeft size={48} />
            </button>

            <div className="max-w-6xl w-full h-full flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.img
                  key={filteredImages[lightboxImage].id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  src={filteredImages[lightboxImage].src}
                  alt={filteredImages[lightboxImage].title}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </AnimatePresence>
            </div>

            <button
              onClick={nextImage}
              className="absolute right-4 text-white hover:text-gray-300 z-10"
            >
              <ChevronRight size={48} />
            </button>

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white text-center">
              <p className="text-lg font-semibold mb-2">{filteredImages[lightboxImage].title}</p>
              <p className="text-sm text-gray-300">
                {lightboxImage + 1} / {filteredImages.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
