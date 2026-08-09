/**
 * Column names match the Supabase `itinerary_days` and `itinerary_items` tables.
 */
export type ItineraryDay = {
  id: string;
  trip_id: string;
  date: string | null;
  day_number: number;
};

export type ItineraryDayInsert = Pick<
  ItineraryDay,
  "trip_id" | "day_number" | "date"
>;

export type ItineraryItem = {
  id: string;
  itinerary_day_id: string;
  place_id: string;
  order_index: number;
};

export type ItineraryItemInsert = Pick<
  ItineraryItem,
  "itinerary_day_id" | "place_id" | "order_index"
>;

export type PlanningPlace = {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number | null;
};

export type PlanningDayItem = {
  id: string;
  order_index: number;
  place: PlanningPlace;
};

export type PlanningDay = {
  id: string;
  day_number: number;
  date: string | null;
  items: PlanningDayItem[];
};

export type PlanningBoardData = {
  days: PlanningDay[];
  unplannedPlaces: PlanningPlace[];
};
