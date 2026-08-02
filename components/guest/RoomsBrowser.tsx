'use client';

// useMemo caches an expensive computed value between renders, only
// recalculating it when its dependencies change (used below for `stats`).
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomCard } from '@/components/guest/RoomCard';
import { Button } from '@/components/ui/Button';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { formatCurrency } from '@/lib/utils';
import { getFacilityIcon } from '@/lib/facility-icons';
import { useCurrency } from '@/components/CurrencyProvider';
import { resolveAdvertisedRate } from '@/lib/pricing';
import {
  Search,
  SlidersHorizontal,
  Users,
  Bed,
  LayoutGrid,
  Rows3,
  ArrowUpDown,
  BedDouble,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export interface BrowsableRoom {
  id: string;
  name: string;
  description: string;
  price: number;
  todayRates: { currency: string; market: string; price: number }[];
  maxGuests: number;
  size: number;
  image: string | null;
  amenities: { label: string; icon: string }[];
}

type ViewMode = 'grid' | 'list';

// Dropdown options for the "guests" filter — each maps to a minimum guest
// capacity the room must support ('all' means no filtering).
const GUEST_OPTIONS = [
  { value: 'all', label: 'All Guests' },
  { value: '1', label: '1 Guest' },
  { value: '2', label: '2+ Guests' },
  { value: '3', label: '3+ Guests' },
  { value: '4', label: '4+ Guests' },
];

// Dropdown options for the "sort by" selector.
const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'capacity', label: 'Guest Capacity' },
];

// The "/rooms" page's main content: a hero banner, a search/filter/sort bar,
// and the resulting list of rooms (as a grid or list), all driven by client-
// side state so filtering/sorting/switching views doesn't need a page reload.
// `rooms` is passed in already-loaded from the server (a Server Component
// fetches the data and hands it to this Client Component as a prop).
export function RoomsBrowser({ rooms }: { rooms: BrowsableRoom[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGuests, setFilterGuests] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');
  // Whether the mobile filter panel is expanded (only relevant on small screens).
  const [showFilters, setShowFilters] = useState(false);
  // Whether rooms are displayed as a card grid or a horizontal list.
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const { currency, market, rates } = useCurrency();

  // Summary numbers shown in the hero banner (room count, cheapest price,
  // largest capacity). useMemo avoids recalculating these on every render —
  // only recompute when the `rooms` prop or active currency/market/rates
  // change. The cheapest room is found by true LKR price (never a converted
  // amount, so it doesn't change with currency/market), then its price is
  // resolved into the active currency/market for display — always one
  // room's price, never a mix.
  const stats = useMemo(() => {
    if (rooms.length === 0) return null;
    const cheapest = rooms.reduce((min, r) => (r.price < min.price ? r : min), rooms[0]);
    return {
      count: rooms.length,
      minPrice: resolveAdvertisedRate(cheapest, currency, market, rates),
      maxGuests: Math.max(...rooms.map(r => r.maxGuests)),
    };
  }, [rooms, currency, market, rates]);

  // Recomputed on every render (not memoized) from the raw `rooms` list:
  // first filters by the search text and guest count, then sorts according
  // to the selected sort option.
  const filteredRooms = rooms
    .filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           room.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGuests = filterGuests === 'all' || room.maxGuests >= parseInt(filterGuests);
      return matchesSearch && matchesGuests;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'capacity':
          return b.maxGuests - a.maxGuests;
        default:
          // 'recommended' keeps the original order from the server
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fadeIn">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-primary to-primary-dark text-white py-24 px-4">
        <div className="absolute top-10 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-accent/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />

        <div className="container mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles size={14} className="text-accent" />
              Nuwara Eliya, Sri Lanka
            </div>
            <h1 className="text-5xl md:text-6xl font-heading font-bold mb-4">Our Rooms &amp; Suites</h1>
            <p className="text-xl text-gray-200 max-w-2xl mx-auto">
              Choose from our collection of beautifully appointed rooms and suites
            </p>
          </motion.div>

          {/* Quick stats strip — only rendered if there's at least one room */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
              className="flex flex-wrap justify-center gap-6 md:gap-12 mt-10"
            >
              <div>
                <p className="text-3xl font-heading font-bold">{stats.count}</p>
                <p className="text-sm text-gray-200/80">Room{stats.count !== 1 ? 's' : ''} &amp; Suites</p>
              </div>
              <div className="w-px bg-white/20" />
              <div>
                <p className="text-3xl font-heading font-bold">{formatCurrency(stats.minPrice.amount, stats.minPrice.currency)}</p>
                <p className="text-sm text-gray-200/80">Starting per night</p>
              </div>
              <div className="w-px bg-white/20" />
              <div>
                <p className="text-3xl font-heading font-bold">Up to {stats.maxGuests}</p>
                <p className="text-sm text-gray-200/80">Guests per room</p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Search and Filter Section — sticky so it stays visible while scrolling the results */}
      <section className="glass-strong sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2 w-full md:w-auto">
              <StyledSelect
                value={filterGuests}
                onChange={setFilterGuests}
                options={GUEST_OPTIONS}
                className="flex-1 md:flex-none md:w-44"
              />

              <StyledSelect
                value={sortBy}
                onChange={setSortBy}
                options={SORT_OPTIONS}
                className="flex-1 md:flex-none md:w-52"
              />

              {/* Grid / List toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-white/70 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-600 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-primary-light hover:text-primary'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-primary-light hover:text-primary'}`}
                >
                  <Rows3 size={18} />
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden px-4 py-2.5 bg-primary text-white rounded-xl"
              >
                <SlidersHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              {/* AnimatePresence + a key tied to the count makes the number
                  animate (slide/fade) each time the filtered result count changes */}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={filteredRooms.length}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  {filteredRooms.length}
                </motion.span>
              </AnimatePresence>
              Room{filteredRooms.length !== 1 ? 's' : ''} Available
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <ArrowUpDown size={14} />
              Sorted by {sortBy === 'recommended' ? 'recommended' : sortBy.replace('-', ' ')}
            </div>
          </div>

          {/* Three possible outcomes: no matches, grid view, or list view */}
          {filteredRooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <Bed className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={64} />
              <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No rooms found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms</p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6"
                onClick={() => {
                  setSearchTerm('');
                  setFilterGuests('all');
                  setSortBy('recommended');
                }}
              >
                Clear Filters
              </Button>
            </motion.div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRooms.map((room) => (
                <RoomCard key={room.id} {...room} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {filteredRooms.map((room) => (
                <RoomListRow key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative isolate overflow-hidden bg-primary-light dark:bg-gray-900 py-16 px-4">
        <div className="absolute -top-16 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="container mx-auto text-center relative">
          <h2 className="text-3xl font-heading font-bold mb-4">Need Help Choosing?</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
            Our team is here to help you find the perfect room for your stay
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Contact Us
              </Button>
            </Link>
            <Link href="/gallery">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View Gallery
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// A single room rendered as a horizontal row (used when viewMode === 'list'),
// as opposed to RoomCard which renders a vertical grid card.
function RoomListRow({ room }: { room: BrowsableRoom }) {
  // Only show the first 5 amenity icons to keep the row a reasonable height.
  const shownAmenities = room.amenities.slice(0, 5);
  const { currency, market, rates } = useCurrency();
  const displayPrice = resolveAdvertisedRate(room, currency, market, rates);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass-card glow-primary isolate rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500 group flex flex-col sm:flex-row"
    >
      <div className="relative sm:w-72 h-56 sm:h-auto flex-shrink-0 overflow-hidden">
        {room.image ? (
          <div
            className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 group-hover:scale-110 transition-transform duration-[1.2s] ease-out"
            style={{ backgroundImage: `url(${room.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
            <span className="text-primary/40 text-5xl font-bold">{room.name.charAt(0)}</span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h3 className="text-2xl font-heading font-bold text-gray-900 dark:text-gray-100">{room.name}</h3>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{formatCurrency(displayPrice.amount, displayPrice.currency)}</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">/ night</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 text-sm mb-3">
          <div className="flex items-center gap-1">
            <Users size={16} />
            <span>{room.maxGuests} Guests</span>
          </div>
          <div className="flex items-center gap-1">
            <BedDouble size={16} />
            <span>{room.size} sqft</span>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1">{room.description}</p>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {shownAmenities.length > 0 && (
            <div className="flex items-center gap-2">
              {shownAmenities.map((a) => {
                const Icon = getFacilityIcon(a.icon);
                return (
                  <div key={a.label} title={a.label} className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary">
                    <Icon size={16} />
                  </div>
                );
              })}
            </div>
          )}
          <Link href={`/rooms/${room.id}`}>
            <Button variant="primary" size="md" className="group/btn">
              View Details
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
