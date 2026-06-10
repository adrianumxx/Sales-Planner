/**
 * Weekly opening hours for a venue, extracted from Google Places.
 * `days` maps weekday (0 = Sunday … 6 = Saturday) → list of open intervals,
 * each [openMinutes, closeMinutes] from local midnight. An empty/absent array
 * for a weekday means the venue is closed that day.
 * `verified` is false when the Places match was low-confidence (returned venue
 * far from the client's geocoded location) — such hours are shown but never
 * used to constrain scheduling, to avoid moving visits on bad data.
 */
export interface OpeningHours {
  days: Record<number, [number, number][]>;
  verified: boolean;
}

/** Google Places operating status for a venue. */
export type BusinessStatus = 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';

export interface Client {
  id: string;
  clientName: string;
  town: string;
  lastVisitDays: number;
  urgency: 'urgent' | 'attention' | 'ok';
  quality?: number;
  customerDetails?: string;
  address?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  /** True once we've attempted precise (street-level) geocoding via Google Maps. */
  geocoded?: boolean;
  /** True once we've attempted to fetch opening hours via Google Places. */
  hoursAttempted?: boolean;
  openingHours?: OpeningHours;
  /** Operating status from Google Places (e.g. permanently closed). */
  businessStatus?: BusinessStatus;
  daysSinceLastVisit?: number;
}

export interface VisitDay {
  id: string;
  clientName: string;
  town: string;
  address?: string;
  lat?: number;
  lon?: number;
  distance: number;
  urgency: 'urgent' | 'attention' | 'ok';
  timeSlot: string;
  completed: boolean;
  notes: string;
  quality: number;
  lastVisitDays?: number;
  openingHours?: OpeningHours;
  businessStatus?: BusinessStatus;
  /** True when this visit's day has no verified open hours at all (rare). */
  outsideHours?: boolean;
  /** True when the venue opens only outside working hours (e.g. an evening bar)
   *  → visit by appointment; timeSlot shows the venue's real opening time. */
  byAppointment?: boolean;
}

export interface DailyPlan {
  date: string;
  visits: VisitDay[];
  totalKm: number;
}

export interface AppState {
  data: Client[];
  plan: DailyPlan[];
  filter: 'all' | 'urgent' | 'attention' | 'ok';
  completedVisits: Set<string>;
  notes: Record<string, string>;
  homeAddress: string;
  visitsPerDay: number;
  showSettings: boolean;
  darkMode: boolean;
}

export interface CityCoord {
  city: string;
  lat: number;
  lon: number;
}
