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
}[] = [
  { value: "must", label: "Imprescindible (must)" },
  { value: "high", label: "Alta (high)" },
  { value: "medium", label: "Media (medium)" },
  { value: "if_time", label: "Si hay tiempo (if_time)" },
];

export type PlaceInterest = "jonathan" | "wife" | "both";

export const PLACE_INTERESTS: {
  value: PlaceInterest;
  label: string;
}[] = [
  { value: "jonathan", label: "Jonathan" },
  { value: "wife", label: "Esposa" },
  { value: "both", label: "Ambos" },
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
