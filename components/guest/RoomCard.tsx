import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Maximize, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { getFacilityIcon } from '@/lib/facility-icons';
import { useCurrency } from '@/components/CurrencyProvider';
import { resolveAdvertisedRate } from '@/lib/pricing';

interface RoomCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  todayRates?: { currency: string; market: string; price: number }[];
  maxGuests: number;
  size: number;
  image?: string | null;
  amenities?: { label: string; icon: string }[];
  badge?: string;
}

// Reusable room card shown in listing grids (e.g. the rooms browser or
// homepage highlights) — displays a room's photo, price, key stats, a
// handful of amenity icons, and a "View Details" link to its full page.
export const RoomCard: React.FC<RoomCardProps> = ({
  id,
  name,
  description,
  price,
  todayRates = [],
  maxGuests,
  size,
  image,
  amenities = [],
  badge,
}) => {
  // Only show the first 4 amenity icons to keep the card compact; the rest
  // are summarized as "+N more".
  const shownAmenities = amenities.slice(0, 4);
  const extraCount = amenities.length - shownAmenities.length;
  const { currency, market, rates } = useCurrency();
  const displayPrice = resolveAdvertisedRate({ price, todayRates }, currency, market, rates);

  return (
    // motion.div (framer-motion) animates this card in as it scrolls into
    // view (initial -> whileInView) and lifts slightly on hover (whileHover).
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-card glow-primary isolate rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-500 group h-full flex flex-col"
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        {image ? (
          <div
            className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 group-hover:scale-110 transition-transform duration-[1.2s] ease-out"
            style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        ) : (
          // Fallback placeholder (room's initial letter) when no photo is set
          <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
            <span className="text-primary/40 text-5xl font-bold">{name.charAt(0)}</span>
          </div>
        )}
        {/* Subtle darkening on hover for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {badge && (
          <div className="absolute top-4 left-4 bg-primary/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium shadow-md">
            {badge}
          </div>
        )}
        {/* Price chip floating on the image */}
        <div className="absolute bottom-4 right-4 glass-strong rounded-xl px-3 py-2 shadow-lg">
          <span className="text-lg font-bold text-primary">{formatCurrency(displayPrice.amount, displayPrice.currency)}</span>
          <span className="text-gray-600 dark:text-gray-300 text-xs ml-1">/ night</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-2xl font-heading font-bold text-gray-900 dark:text-gray-100 mb-2">{name}</h3>

        {/* Features */}
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400 text-sm mb-3">
          <div className="flex items-center gap-1">
            <Users size={16} />
            <span>{maxGuests} Guests</span>
          </div>
          <div className="flex items-center gap-1">
            <Maximize size={16} />
            <span>{size} sqft</span>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{description}</p>

        {/* Amenities — real facility icons for this room */}
        {shownAmenities.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            {shownAmenities.map((a) => {
              // getFacilityIcon maps a facility's string name (e.g. "wifi")
              // to the matching lucide-react icon component.
              const Icon = getFacilityIcon(a.icon);
              return (
                <div key={a.label} title={a.label} className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary">
                  <Icon size={16} />
                </div>
              );
            })}
            {extraCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">+{extraCount} more</span>
            )}
          </div>
        )}

        {/* Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
          <Link href={`/rooms/${id}`} className="block">
            <Button variant="primary" size="md" className="w-full group/btn">
              View Details
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
