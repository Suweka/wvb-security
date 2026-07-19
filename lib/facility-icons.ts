// Maps facility names stored in the database (e.g. "Wifi", "Coffee") to the
// matching lucide-react icon component, so room facility lists can render an
// icon next to each amenity without hardcoding icon choices all over the UI.
import {
  Wifi,
  Coffee,
  Bath,
  Tv,
  Wind,
  BedDouble,
  Briefcase,
  Trees,
  ShowerHead,
  Sparkles,
  UtensilsCrossed,
  ParkingCircle,
  Armchair,
  Sun,
  Flame,
  Dog,
  Waves,
  Check,
  type LucideIcon, // the TypeScript type shared by every lucide-react icon component
} from 'lucide-react';

// Lookup table: facility name (string) -> icon component. `Record<string, LucideIcon>`
// means "an object whose keys are strings and whose values are LucideIcon components".
export const FACILITY_ICONS: Record<string, LucideIcon> = {
  Wifi,
  Coffee,
  Bath,
  Tv,
  Wind,
  BedDouble,
  Briefcase,
  Trees,
  ShowerHead,
  Sparkles,
  UtensilsCrossed,
  ParkingCircle,
  Armchair,
  Sun,
  Flame,
  Dog,
  Waves,
  Check,
};

// Icon used when a facility name doesn't match any entry in FACILITY_ICONS
// (e.g. a typo, or a name added to the DB without a matching icon here).
export const FALLBACK_FACILITY_ICON: LucideIcon = Check;

// Looks up the icon for a facility name, safely handling missing/unknown names
// by returning the fallback icon instead of throwing or returning undefined.
export function getFacilityIcon(name: string | undefined | null): LucideIcon {
  if (!name) return FALLBACK_FACILITY_ICON;
  return FACILITY_ICONS[name] ?? FALLBACK_FACILITY_ICON;
}

// All known facility icon names, e.g. for populating an admin "choose an icon" dropdown.
export const FACILITY_ICON_NAMES = Object.keys(FACILITY_ICONS);

// The fixed set of facility categories used to group amenities in the UI.
// `as const` makes TypeScript treat this as a tuple of exact string literals
// (not just `string[]`), which is what lets FacilityCategory below work.
export const FACILITY_CATEGORIES = ['room', 'bathroom', 'technology', 'food', 'general'] as const;
// A union type of the literal strings in FACILITY_CATEGORIES, i.e.
// 'room' | 'bathroom' | 'technology' | 'food' | 'general'.
export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];
