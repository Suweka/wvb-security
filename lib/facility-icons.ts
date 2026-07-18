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
  type LucideIcon,
} from 'lucide-react';

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

export const FALLBACK_FACILITY_ICON: LucideIcon = Check;

export function getFacilityIcon(name: string | undefined | null): LucideIcon {
  if (!name) return FALLBACK_FACILITY_ICON;
  return FACILITY_ICONS[name] ?? FALLBACK_FACILITY_ICON;
}

export const FACILITY_ICON_NAMES = Object.keys(FACILITY_ICONS);

export const FACILITY_CATEGORIES = ['room', 'bathroom', 'technology', 'food', 'general'] as const;
export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];
