import type { PlaceCategory } from "@/lib/importers/types";

export const PLACE_CATEGORIES: PlaceCategory[] = [
  "Museo",
  "Restaurante",
  "Compras",
  "Atracción",
  "Café",
  "Otro",
];

export type PlacePriority = "must" | "high" | "medium" | "if_time";

export const PLACE_PRIORITIES: {
  value: PlacePriority;
  label: string;
  shortLabel: string;
  chipClass: string;
  selectedChipClass: string;
}[] = [
  {
    value: "must",
    label: "Imprescindible (must)",
    shortLabel: "Must",
    chipClass: "border-red-500/40 bg-red-950/30 text-red-200",
    selectedChipClass: "border-red-400 bg-red-500/30 text-white ring-2 ring-red-400/50",
  },
  {
    value: "high",
    label: "Alta (high)",
    shortLabel: "Alta",
    chipClass: "border-orange-500/40 bg-orange-950/30 text-orange-200",
    selectedChipClass:
      "border-orange-400 bg-orange-500/30 text-white ring-2 ring-orange-400/50",
  },
  {
    value: "medium",
    label: "Media (medium)",
    shortLabel: "Media",
    chipClass: "border-yellow-500/40 bg-yellow-950/20 text-yellow-100",
    selectedChipClass:
      "border-yellow-400 bg-yellow-500/25 text-white ring-2 ring-yellow-400/50",
  },
  {
    value: "if_time",
    label: "Si hay tiempo (if_time)",
    shortLabel: "Si hay tiempo",
    chipClass: "border-slate-600 bg-slate-900/80 text-slate-300",
    selectedChipClass: "border-slate-400 bg-slate-700 text-white ring-2 ring-slate-400/40",
  },
];

export type PlaceInterest = "jonathan" | "wife" | "both";

export const PLACE_INTERESTS: {
  value: PlaceInterest;
  label: string;
  chipClass: string;
  selectedChipClass: string;
}[] = [
  {
    value: "jonathan",
    label: "Jonathan",
    chipClass: "border-blue-500/40 bg-blue-950/30 text-blue-200",
    selectedChipClass: "border-blue-400 bg-blue-500/30 text-white ring-2 ring-blue-400/50",
  },
  {
    value: "wife",
    label: "Mercedes",
    chipClass: "border-fuchsia-500/40 bg-fuchsia-950/30 text-fuchsia-200",
    selectedChipClass:
      "border-fuchsia-400 bg-fuchsia-500/30 text-white ring-2 ring-fuchsia-400/50",
  },
  {
    value: "both",
    label: "Ambos",
    chipClass: "border-emerald-500/40 bg-emerald-950/30 text-emerald-200",
    selectedChipClass:
      "border-emerald-400 bg-emerald-500/30 text-white ring-2 ring-emerald-400/50",
  },
];

export type PlaceItineraryContext = {
  itemId: string;
  itineraryDayId: string;
  dayNumber: number;
  startTime: string | null;
  isFixed: boolean;
};

export type PlaceDetail = {
  id: string;
  name: string;
  category: string | null;
  priority: string | null;
  interest: string | null;
  duration_minutes: number | null;
  notes: string | null;
  reservation_required: boolean;
  opening_hours: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  status: string;
  maps_url: string | null;
  itinerary: PlaceItineraryContext | null;
};

export type UpdatePlaceInput = {
  placeId: string;
  name: string;
  category: string | null;
  priority: string | null;
  interest: string | null;
  duration_minutes: number | null;
  notes: string | null;
  reservation_required: boolean;
  opening_hours: string | null;
  reservation_start_time: string | null;
  assign_to_day_id: string | null;
};

export type PlaceMutationResult = {
  ok: boolean;
  error?: string;
};
