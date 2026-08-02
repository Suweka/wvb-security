// Renders a single room's full detail page: an image gallery/slider hero,
// description, amenities, policies, reviews, and a sticky booking widget
// that lets the visitor pick dates/guests and jump to the booking page.
// One room ("family-room") gets a different gallery layout — see the
// MasonryGallery component and the branch in RoomDetailClient below.
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/components/CurrencyProvider';
import { resolveAdvertisedRate } from '@/lib/pricing';
import {
  Users,
  Maximize,
  Wifi,
  Coffee,
  Bath,
  Sparkles,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Calendar,
  Minus,
  Plus,
  type LucideIcon,
} from 'lucide-react';

// Shape of the room data this component needs — passed in as a prop from
// the server-rendered room page after it fetches the room from the database.
export interface RoomDetailData {
  slug: string;
  name: string;
  price: number;
  todayRates: { currency: string; market: string; price: number }[];
  maxGuests: number;
  size: number;
  beds: string;
  description: string;
  images: string[];
  facilityGroups: { category: string; label: string; items: string[] }[];
}

// Maps each facility "category" string to the icon shown next to its
// section heading in the Amenities list.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  room: Maximize,
  bathroom: Bath,
  technology: Wifi,
  food: Coffee,
  general: Sparkles,
};

// Booking policies are the same for every room, so they're hard-coded here
// rather than coming from the database.
const SHARED_POLICIES = {
  checkIn: '2:00 PM',
  checkOut: '11:00 AM',
  cancellation: 'Free cancellation up to 24 hours before check-in',
  smoking: 'No smoking',
  pets: 'Pets not allowed',
};

// Placeholder reviews shown on every room's page (not room-specific, and not
// loaded from a database — just static sample content).
const SHARED_REVIEWS = [
  {
    name: 'Sarah Johnson',
    rating: 5,
    date: '2 weeks ago',
    comment: 'Absolutely stunning room with incredible views. The bed was so comfortable and the staff was amazing!',
  },
  {
    name: 'Michael Chen',
    rating: 5,
    date: '1 month ago',
    comment: 'Best hotel experience in Nuwara Eliya. The room was spotless and had everything we needed.',
  },
  {
    name: 'Emma Wilson',
    rating: 4,
    date: '2 months ago',
    comment: 'Beautiful vintage charm with modern comforts. Highly recommend for a romantic getaway.',
  },
];

// Alternative gallery layout used ONLY for the "family-room" (see the
// `room.slug === 'family-room'` check in RoomDetailClient below). Instead of
// the full-bleed sliding hero used by every other room, this room has many
// more photos, so they're shown as a Pinterest-style masonry grid (CSS
// multi-column layout — `columns-2 sm:columns-3 lg:columns-4`) that lets
// photos of different heights sit compactly next to each other. Clicking any
// photo opens the same lightbox used by the slider, via onOpenPhoto.
function MasonryGallery({
  images,
  name,
  onOpenPhoto,
}: {
  images: string[];
  name: string;
  onOpenPhoto: (index: number) => void;
}) {
  const hasImages = images.length > 0;

  return (
    <section className="relative bg-gray-50 dark:bg-gray-900/40 py-10 md:py-14">
      <div className="container mx-auto px-4">
        {hasImages ? (
          // `columns-N` splits the container into N CSS columns and lets
          // items flow top-to-bottom, left-to-right, filling gaps — this is
          // what creates the masonry (Pinterest-like) effect, as opposed to
          // a strict row-by-row grid.
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onOpenPhoto(i)}
                // break-inside-avoid stops a single photo from being split
                // across two columns.
                className="group relative block w-full mb-3 sm:mb-4 break-inside-avoid overflow-hidden rounded-xl shadow-sm hover:shadow-xl transition-shadow duration-300"
              >
                <img
                  src={src}
                  alt={`${name} photo ${i + 1}`}
                  loading="lazy"
                  className="w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          // Fallback shown if this room somehow has no photos at all.
          <div className="w-full aspect-video bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center rounded-xl">
            <span className="text-primary/40 text-6xl font-bold">{name.charAt(0)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function RoomDetailClient({ room }: { room: RoomDetailData }) {
  const router = useRouter();

  // Which photo is currently shown in the slider/lightbox.
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // Whether the full-screen photo lightbox is open.
  const [showLightbox, setShowLightbox] = useState(false);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  // Defaults to 2 guests, but never more than the room actually allows.
  const [guests, setGuests] = useState(Math.min(2, room.maxGuests));

  const { currency, market, rates } = useCurrency();
  const displayPrice = resolveAdvertisedRate(room, currency, market, rates);

  const images = room.images;
  const hasImages = images.length > 0;

  // Advances the slider/lightbox to the next photo, wrapping back to the
  // first photo after the last one (modulo arithmetic).
  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  // Moves to the previous photo, wrapping around to the last photo if
  // currently on the first one.
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  // Average of the (static, shared) review ratings, shown next to the room title.
  const averageRating = SHARED_REVIEWS.reduce((acc, r) => acc + r.rating, 0) / SHARED_REVIEWS.length;

  // Formats a Date as "YYYY-MM-DD" for the booking page's URL query string.
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Navigates to /booking, pre-filling the room, guest count, and any
  // check-in/check-out dates the visitor already picked in the sidebar widget.
  const handleBookNow = () => {
    const params = new URLSearchParams({ room: room.slug, guests: guests.toString() });
    if (checkIn)  params.set('checkIn',  toISO(checkIn));
    if (checkOut) params.set('checkOut', toISO(checkOut));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white animate-fadeIn">
      {/* Image Gallery */}
      {/* Room-specific layout branch: the "family-room" has a much larger
          photo set curated for a masonry grid, so it gets MasonryGallery
          instead of the standard full-bleed sliding hero every other room
          uses. This is purely a display choice tied to that one room's
          content — there's nothing else special about family-room's data. */}
      {room.slug === 'family-room' ? (
        <MasonryGallery
          images={images}
          name={room.name}
          onOpenPhoto={(i) => {
            setCurrentImageIndex(i);
            setShowLightbox(true);
          }}
        />
      ) : (
      // Standard hero: a full-width, full-bleed image slider with arrows,
      // dot indicators, and a "view all photos" button that opens the lightbox.
      <section className="relative isolate overflow-hidden h-[65vh] min-h-[420px] max-h-[750px] bg-gray-900 group">
        {/* Horizontal strip of all images, shifted left by (index * 100%) so
            only the current one is visible — this is what makes it "slide". */}
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
        >
          {(hasImages ? images : [undefined]).map((src, i) => (
            <div
              key={i}
              className="relative w-full h-full flex-shrink-0 cursor-pointer"
              onClick={() => hasImages && setShowLightbox(true)}
            >
              {src ? (
                <>
                  {/* Blurred fill so the frame is never empty behind a non-cover aspect ratio */}
                  <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  <img
                    src={src}
                    alt={room.name}
                    className="relative w-full h-full object-contain"
                  />
                </>
              ) : (
                // Fallback shown if the room has no photos at all.
                <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                  <span className="text-primary/40 text-6xl font-bold">{room.name.charAt(0)}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom gradient + room name */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex items-end justify-between gap-4 pointer-events-none">
          <p className="text-white text-3xl md:text-5xl font-heading font-bold drop-shadow-lg">{room.name}</p>
          {hasImages && (
            <span className="text-white/90 text-sm bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg flex-shrink-0">
              {currentImageIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Prev/next arrows + dot indicators — only shown when there's more than one photo */}
        {hasImages && images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={nextImage}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentImageIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {hasImages && (
          <button
            onClick={() => setShowLightbox(true)}
            className="absolute top-6 right-6 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors"
          >
            {images.length > 1 ? `View all ${images.length} photos` : 'View photo'}
          </button>
        )}
      </section>
      )}

      {/* Content */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-4xl font-heading font-bold">{room.name}</h1>
                <div className="flex items-center gap-2">
                  <Star className="fill-accent text-accent" size={20} />
                  <span className="text-xl font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-500 dark:text-gray-400">({SHARED_REVIEWS.length} reviews)</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Users size={20} />
                  <span>Up to {room.maxGuests} Guest{room.maxGuests > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Maximize size={20} />
                  <span>{room.size} sqft</span>
                </div>
                {room.beds && (
                  <div className="flex items-center gap-2">
                    <Bath size={20} />
                    <span>{room.beds}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description — only rendered if the room actually has one */}
            {room.description && (
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-semibold mb-4">About This Room</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{room.description}</p>
              </div>
            )}

            {/* Amenities — grouped by category (room/bathroom/technology/food/general) */}
            {room.facilityGroups.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-semibold mb-6">Room Amenities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {room.facilityGroups.map(group => {
                    // Pick the icon for this group's category, falling back
                    // to a generic sparkle icon if the category is unrecognized.
                    const HeaderIcon = CATEGORY_ICON[group.category] || Sparkles;
                    return (
                      <div key={group.category}>
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <HeaderIcon size={20} className="text-primary" /> {group.label}
                        </h3>
                        <ul className="space-y-2">
                          {group.items.map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Check size={16} className="text-primary" /> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Policies — same for every room, from SHARED_POLICIES above */}
            <div className="mb-8 bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <h2 className="text-2xl font-heading font-semibold mb-4">Rules & Regulations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-primary" size={20} />
                    <span className="font-semibold">Check-in/Check-out</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">Check-in: {SHARED_POLICIES.checkIn}</p>
                  <p className="text-gray-700 dark:text-gray-300">Check-out: {SHARED_POLICIES.checkOut}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <X className="text-primary" size={20} />
                    <span className="font-semibold">Cancellation</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{SHARED_POLICIES.cancellation}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <X size={16} className="text-red-500" /> {SHARED_POLICIES.smoking}
                  </li>
                  <li className="flex items-center gap-2">
                    <X size={16} className="text-red-500" /> {SHARED_POLICIES.pets}
                  </li>
                </ul>
              </div>
            </div>

            {/* Reviews — static sample reviews shared across all rooms */}
            <div className="mb-8">
              <h2 className="text-2xl font-heading font-semibold mb-6">Guest Reviews</h2>
              <div className="space-y-6">
                {SHARED_REVIEWS.map((review, index) => (
                  <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {review.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{review.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{review.date}</p>
                          </div>
                          <div className="flex gap-1">
                            {/* Renders `review.rating` filled star icons */}
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="fill-accent text-accent" size={16} />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Widget — sticky sidebar with date pickers, guest count, and Book Now */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-primary-light p-6 rounded-lg shadow-lg">
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-primary">{formatCurrency(displayPrice.amount, displayPrice.currency)}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">per night (includes taxes)</p>
              </div>

              <div className="space-y-4 mb-6">
                {/* Immediately-invoked function so `today`/`checkOutMin` can
                    be computed locally without cluttering the component body
                    above — only needed right here for the date pickers. */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  // Earliest selectable check-out date: the day after
                  // check-in if chosen, otherwise the day after today.
                  const checkOutMin = checkIn
                    ? new Date(checkIn.getTime() + 86_400_000)
                    : new Date(today.getTime() + 86_400_000);
                  return (
                    <>
                      <DatePickerField
                        label="Check-in"
                        value={checkIn}
                        minDate={today}
                        onChange={d => { setCheckIn(d); if (checkOut && d >= checkOut) setCheckOut(null); }}
                      />
                      <DatePickerField
                        label="Check-out"
                        value={checkOut}
                        minDate={checkOutMin}
                        onChange={d => setCheckOut(d)}
                      />
                    </>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guests</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGuests(g => Math.max(1, g - 1))}
                      disabled={guests <= 1}
                      className="w-9 h-9 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-primary hover:bg-primary-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 min-w-[80px] text-center">
                      {guests} {guests === 1 ? 'Guest' : 'Guests'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuests(g => Math.min(room.maxGuests, g + 1))}
                      disabled={guests >= room.maxGuests}
                      className="w-9 h-9 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-primary hover:bg-primary-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <Button variant="primary" size="lg" className="w-full mb-4" onClick={handleBookNow}>
                Book Now
              </Button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <p>Free cancellation within 24 hours</p>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Need help booking?</p>
                <Button variant="outline" size="md" className="w-full" onClick={() => router.push('/contact')}>
                  Contact Us
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox — full-screen photo viewer, shared by both the standard
          slider hero and the family-room MasonryGallery (opened via
          onOpenPhoto/setShowLightbox from either one) */}
      {showLightbox && hasImages && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <button onClick={() => setShowLightbox(false)} className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X size={32} />
          </button>
          {images.length > 1 && (
            <button onClick={prevImage} className="absolute left-4 text-white hover:text-gray-300">
              <ChevronLeft size={48} />
            </button>
          )}
          <div className="max-w-5xl w-full aspect-video">
            <img src={images[currentImageIndex]} alt={room.name} className="w-full h-full object-contain" />
          </div>
          {images.length > 1 && (
            <button onClick={nextImage} className="absolute right-4 text-white hover:text-gray-300">
              <ChevronRight size={48} />
            </button>
          )}
          <div className="absolute bottom-4 text-white text-sm">
            {currentImageIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
