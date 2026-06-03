export interface Client {
  quality: number;
  customerDetails: string;
  town: string;
  daysSinceLastVisit: number;
}

export interface VisitDay {
  id: string;
  clientName: string;
  town: string;
  distance: number;
  urgency: 'urgent' | 'attention' | 'ok';
  timeSlot: string;
  completed: boolean;
  notes: string;
  quality: number;
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
