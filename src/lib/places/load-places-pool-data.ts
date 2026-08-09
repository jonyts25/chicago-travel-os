import { PLACE_STATUS_UNPLANNED } from "@/lib/constants";
import type { PlanningDay, PlanningPlace } from "@/lib/itinerary/schema";
import { loadPlaceVisitSummariesForTrip } from "@/lib/places/load-place-visit-summaries";
import { hasCoordinates } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";

export type PlacesPoolData = {
  days: PlanningDay[];
  unplannedPlaces: PlanningPlace[];
  unlocatedPlaces: PlanningPlace[];
};

export async function loadPlacesPoolData(
  tripId: string,
  includeItineraryDays: boolean,
): Promise<{ data: PlacesPoolData | null; error: string | null }> {
  const supabase = await createClient();

  const [daysResult, unplannedResult] = await Promise.all([
    includeItineraryDays
      ? supabase
          .from("itinerary_days")
          .select("id, day_number, focus, date")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("places")
      .select("id, name, category, duration_minutes, lat, lng")
      .eq("trip_id", tripId)
      .eq("status", PLACE_STATUS_UNPLANNED)
      .order("name", { ascending: true }),
  ]);

  if (daysResult.error) {
    return { data: null, error: daysResult.error.message };
  }

  if (unplannedResult.error) {
    return { data: null, error: unplannedResult.error.message };
  }

  const days: PlanningDay[] = (daysResult.data ?? []).map((day) => ({
    id: day.id,
    day_number: day.day_number,
    date: day.date,
    focus: day.focus,
    day_end_override: null,
    focus_category: null,
    focus_label: day.focus,
    day_end_source: "default",
    day_start_source: "default",
    day_active_minutes_limit: 0,
    day_start_minutes: 0,
    day_end_minutes: 0,
    calendar_date: day.date,
    calendar_date_label: null,
    items: [],
  }));

  const unplannedPlaces: PlanningPlace[] = [];
  const unlocatedPlaces: PlanningPlace[] = [];

  for (const place of unplannedResult.data ?? []) {
    const summary = {
      id: place.id,
      name: place.name,
      category: place.category,
      duration_minutes: place.duration_minutes,
    };

    if (hasCoordinates(place)) {
      unplannedPlaces.push(summary);
    } else {
      unlocatedPlaces.push(summary);
    }
  }

  const allPlaceIds = [...unplannedPlaces, ...unlocatedPlaces].map((place) => place.id);
  const visitSummaries = await loadPlaceVisitSummariesForTrip(tripId, allPlaceIds);

  for (const place of unplannedPlaces) {
    const visitSummary = visitSummaries.get(place.id);
    if (visitSummary) {
      place.visitSummary = visitSummary;
    }
  }

  for (const place of unlocatedPlaces) {
    const visitSummary = visitSummaries.get(place.id);
    if (visitSummary) {
      place.visitSummary = visitSummary;
    }
  }

  return {
    data: { days, unplannedPlaces, unlocatedPlaces },
    error: null,
  };
}
