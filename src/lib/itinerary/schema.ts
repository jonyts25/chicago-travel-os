/**
 * Column names match the Supabase `itinerary_days` and `itinerary_items` tables.
 */
export type ItineraryDay = {
  id: string;
  trip_id: string;
  date: string | null;
  day_number: number;
  focus: string | null;
  day_end_override: string | null;
};

export type ItineraryDayInsert = Pick<
  ItineraryDay,
  "trip_id" | "day_number" | "date"
>;

export type ItineraryItemStatus = "pending" | "done" | "skipped";

export type ItineraryItem = {
  id: string;
  itinerary_day_id: string;
  place_id: string;
  order_index: number;
  is_fixed: boolean | null;
  start_time: string | null;
  end_time: string | null;
  status: ItineraryItemStatus | null;
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
  is_fixed: boolean;
  start_time: string | null;
  end_time: string | null;
  place: PlanningPlace;
};

export type PlanningDay = {
  id: string;
  day_number: number;
  date: string | null;
  focus: string | null;
  day_end_override: string | null;
  focus_category: string | null;
  focus_label: string | null;
  day_end_source: "manual" | "flight" | "default";
  day_active_minutes_limit: number;
  items: PlanningDayItem[];
};

export type TripPlanningSettings = {
  flight_departure: string | null;
  airport_transfer_minutes: number;
};

export type PlanningBoardData = {
  days: PlanningDay[];
  unplannedPlaces: PlanningPlace[];
  unlocatedPlaces: PlanningPlace[];
  tripSettings: TripPlanningSettings;
};
