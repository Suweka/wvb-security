'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { formatCurrency } from '@/lib/utils';
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

export interface RoomDetailData {
  slug: string;
  name: string;
  price: number;
  maxGuests: number;
  size: number;
  beds: string;
  description: string;
  images: string[];
  facilityGroups: { category: string; label: string; items: string[] }[];
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  room: Maximize,
  bathroom: Bath,
  technology: Wifi,
  food: Coffee,
  general: Sparkles,
};

const SHARED_POLICIES = {
  checkIn: '2:00 PM',
  checkOut: '11:00 AM',
  cancellation: 'Free cancellation up to 24 hours before check-in',
  smoking: 'No smoking',
  pets: 'Pets not allowed',
};

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

function GalleryImage({ src, name, className, onClick }: { src?: string; name: string; className?: string; onClick?: () => void }) {
  if (src) {
    return <img src={src} alt={name} className={className} onClick={onClick} />;
  }
  return (
    <div
      className={`${className} bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center`}
      onClick={onClick}
    >
      <span className="text-primary/40 text-6xl font-bold">{name.charAt(0)}</span>
    </div>
  );
}

export function RoomDetailClient({ room }: { room: RoomDetailData }) {
  const router = useRouter();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(Math.min(2, room.maxGuests));

  const images = room.images;
  const hasImages = images.length > 0;

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const averageRating = SHARED_REVIEWS.reduce((acc, r) => acc + r.rating, 0) / SHARED_REVIEWS.length;

  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleBookNow = () => {
    const params = new URLSearchParams({ room: room.slug, guests: guests.toString() });
    if (checkIn)  params.set('checkIn',  toISO(checkIn));
    if (checkOut) params.set('checkOut', toISO(checkOut));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white animate-fadeIn">
      {/* Image Gallery */}
      <section className="relative isolate overflow-hidden h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 h-[500px]">
          <div className="md:col-span-3 relative overflow-hidden group">
            <GalleryImage
              src={images[0]}
              name={room.name}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => hasImages && setShowLightbox(true)}
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none" />
            {hasImages && (
              <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                View All Photos
              </div>
            )}
          </div>
          <div className="hidden md:grid grid-rows-2 gap-2">
            <div className="relative overflow-hidden">
              <GalleryImage
                src={images[1] ?? images[0]}
                name={room.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => hasImages && setShowLightbox(true)}
              />
            </div>
            <div className="relative overflow-hidden">
              <GalleryImage
                src={images[2] ?? images[0]}
                name={room.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => hasImages && setShowLightbox(true)}
              />
            </div>
          </div>
        </div>
      </section>

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

            {/* Description */}
            {room.description && (
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-semibold mb-4">About This Room</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{room.description}</p>
              </div>
            )}

            {/* Amenities */}
            {room.facilityGroups.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-semibold mb-6">Room Amenities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {room.facilityGroups.map(group => {
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

            {/* Policies */}
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

            {/* Reviews */}
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

          {/* Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-primary-light p-6 rounded-lg shadow-lg">
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-primary">{formatCurrency(room.price)}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">per night (includes taxes)</p>
              </div>

              <div className="space-y-4 mb-6">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
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

      {/* Lightbox */}
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
