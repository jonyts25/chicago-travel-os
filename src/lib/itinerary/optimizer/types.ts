import type { PlaceInterest } from "@/lib/places/place-detail";

export const DEFAULT_DAY_ACTIVE_MINUTES = 8 * 60;
/** Fallback when coordinates are unavailable during scheduling. */
export const TRAVEL_MINUTES_BETWEEN_STOPS = 20;
/** Conservative urban mixed walk/transit speed for Haversine travel estimates. */
export const URBAN_TRAVEL_SPEED_KMH = 20;
export const DEFAULT_VISIT_MINUTES = 60;

export type PlacePriority = "must" | "high" | "medium" | "if_time";

export const PRIORITY_RANK: Record<PlacePriority, number> = {
  must: 0,
  high: 1,
  medium: 2,
  if_time: 3,
};

export function normalizePriorityRank(priority: string | null | undefined): number {
  if (priority && priority in PRIORITY_RANK) {
    return PRIORITY_RANK[priority as PlacePriority];
  }

  return PRIORITY_RANK.medium;
}

export type OptimizerPlace = {
  id: string;
  lat: number;
  lng: number;
  durationMinutes: number;
  priorityRank: number;
  interest: PlaceInterest;
  category: string | null;
};

export type OptimizerDayContext = {
  dayId: string;
  dayNumber: number;
  lockedPlaceIds: string[];
  lockedPlaces: OptimizerPlace[];
  usedMinutes: number;
  centroid: { lat: number; lng: number } | null;
  dayActiveMinutesLimit: number;
  dayStartMinutes: number;
  focusCategory: string | null;
  focusLabel: string | null;
};

export type OptimizerInput = {
  days: OptimizerDayContext[];
  pool: OptimizerPlace[];
  /** place_ids already present in any day of the trip — never assign twice. */
  usedPlaceIds: ReadonlySet<string>;
};

export type OptimizerDayPlan = {
  dayId: string;
  dayNumber: number;
  orderedPlaceIds: string[];
};

export type OptimizerPlan = {
  dayPlans: OptimizerDayPlan[];
  unassignedDueToTime: string[];
};

export type OptimizerSummary = {
  ok: boolean;
  error?: string;
  assignedByDay: { dayNumber: number; count: number }[];
  unassignedDueToTime: number;
  withoutCoordinates: number;
  warnings: string[];
};
