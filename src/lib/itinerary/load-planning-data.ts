import { PLACE_STATUS_UNPLANNED } from "@/lib/constants";
import { ensureItineraryDays } from "@/lib/itinerary/ensure-days";
import {
  resolveDayConstraints,
  type ItineraryDayConstraintsInput,
  type TripDayConstraintsInput,
} from "@/lib/itinerary/day-constraints";
import { syncItineraryDayDatesFromAnchor } from "@/lib/itinerary/sync-day-dates";
import type {
  PlanningBoardData,
  PlanningDay,
  PlanningDayItem,
  PlanningPlace,
  TripPlanningSettings,
} from "@/lib/itinerary/schema";
import { hasCoordinates } from "@/lib/places/schema";
import { loadPlaceVisitSummariesForTrip } from "@/lib/places/load-place-visit-summaries";
import {
  describeTripAnchorSource,
  resolveTripAnchorDate,
  resolveTripDayCalendar,
} from "@/lib/trips/trip-calendar";
import { TRIP_TRAVEL_SELECT, normalizeTripTravelSettings } from "@/lib/trips/travel-info";
import { createClient } from "@/lib/supabase/server";

type ItemRow = {
  id: string;
  order_index: number;
  itinerary_day_id: string;
  place_id: string;
  is_fixed: boolean | null;
  start_time: string | null;
  end_time: string | null;
  places: PlanningPlace | PlanningPlace[] | null;
};

export async function loadPlanningBoardData(tripId: string): Promise<{
  data: PlanningBoardData | null;
  error: string | null;
}> {
  const { days: initialDays, error: ensureError } =
    await ensureItineraryDays(tripId);

  if (ensureError) {
    return { data: null, error: ensureError };
  }

  const supabase = await createClient();

  const { data: tripResult, error: tripResultError } = await supabase
    .from("trips")
    .select(TRIP_TRAVEL_SELECT)
    .eq("id", tripId)
    .maybeSingle();

  if (tripResultError) {
    return { data: null, error: tripResultError.message };
  }

  const tripSettings: TripPlanningSettings = normalizeTripTravelSettings(tripResult);
  const anchorInput = {
    startDate: tripSettings.start_date,
    hotelCheckin: tripSettings.hotel_checkin,
    flightArrival: tripSettings.flight_arrival,
    timezone: tripSettings.timezone,
  };
  const tripAnchorDate = resolveTripAnchorDate(anchorInput);
  const tripAnchorSource = describeTripAnchorSource(anchorInput);

  const { days: itineraryDays, error: syncError } = await syncItineraryDayDatesFromAnchor(
    tripId,
    initialDays,
    anchorInput,
  );

  if (syncError) {
    return { data: null, error: syncError };
  }

  const dayIds = itineraryDays.map((day) => day.id);

  const [itemsResult, unplannedResult] = await Promise.all([
    dayIds.length > 0
      ? supabase
          .from("itinerary_items")
          .select(
            "id, order_index, itinerary_day_id, place_id, is_fixed, start_time, end_time, places ( id, name, category, duration_minutes )",
          )
          .in("itinerary_day_id", dayIds)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("places")
      .select("id, name, category, duration_minutes, lat, lng")
      .eq("trip_id", tripId)
      .eq("status", PLACE_STATUS_UNPLANNED)
      .order("name", { ascending: true }),
  ]);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error.message };
  }

  if (unplannedResult.error) {
    return { data: null, error: unplannedResult.error.message };
  }

  const tripConstraints: TripDayConstraintsInput = {
    timezone: tripSettings.timezone,
    flightArrival: tripSettings.flight_arrival,
    flightDeparture: tripSettings.flight_departure,
    airportTransferMinutes: tripSettings.airport_transfer_minutes,
  };

  const dayConstraintInputs: ItineraryDayConstraintsInput[] = itineraryDays.map((day) => {
    const calendar = resolveTripDayCalendar(day.day_number, day.date, tripAnchorDate);

    return {
      id: day.id,
      dayNumber: day.day_number,
      date: calendar.calendarDate ?? day.date,
      focus: day.focus,
      dayEndOverride: day.day_end_override,
    };
  });

  const itemsByDay = new Map<string, PlanningDayItem[]>();

  for (const row of (itemsResult.data ?? []) as ItemRow[]) {
    const place = normalizePlaceJoin(row.places);
    if (!place) {
      continue;
    }

    const item: PlanningDayItem = {
      id: row.id,
      order_index: row.order_index,
      is_fixed: Boolean(row.is_fixed),
      start_time: row.start_time,
      end_time: row.end_time,
      place,
    };

    const dayItems = itemsByDay.get(row.itinerary_day_id) ?? [];
    dayItems.push(item);
    itemsByDay.set(row.itinerary_day_id, dayItems);
  }

  const days: PlanningDay[] = itineraryDays.map((day) => {
    const items = itemsByDay.get(day.id) ?? [];
    items.sort((a, b) => a.order_index - b.order_index);

    const calendar = resolveTripDayCalendar(day.day_number, day.date, tripAnchorDate);
    const constraintDate = calendar.calendarDate ?? day.date;

    const resolved = resolveDayConstraints(
      {
        id: day.id,
        dayNumber: day.day_number,
        date: constraintDate,
        focus: day.focus,
        dayEndOverride: day.day_end_override,
      },
      tripConstraints,
      dayConstraintInputs,
    );

    return {
      id: day.id,
      day_number: day.day_number,
      date: constraintDate,
      focus: day.focus,
      day_end_override: day.day_end_override,
      focus_category: resolved.focusCategory,
      focus_label: resolved.focusLabel,
      day_end_source: resolved.dayEndSource,
      day_start_source: resolved.dayStartSource,
      day_active_minutes_limit: resolved.dayActiveMinutesLimit,
      day_start_minutes: resolved.dayStartMinutes,
      day_end_minutes: resolved.dayEndMinutes,
      calendar_date: calendar.calendarDate,
      calendar_date_label: calendar.calendarDateLabel,
      items,
    };
  });

  const allUnplanned = (unplannedResult.data ?? []) as Array<
    PlanningPlace & { lat: number | null; lng: number | null }
  >;

  const unplannedPlaces: PlanningPlace[] = [];
  const unlocatedPlaces: PlanningPlace[] = [];

  for (const place of allUnplanned) {
    if (hasCoordinates(place)) {
      unplannedPlaces.push({
        id: place.id,
        name: place.name,
        category: place.category,
        duration_minutes: place.duration_minutes,
      });
    } else {
      unlocatedPlaces.push({
        id: place.id,
        name: place.name,
        category: place.category,
        duration_minutes: place.duration_minutes,
      });
    }
  }

  const allPlaceIds = [...unplannedPlaces, ...unlocatedPlaces].map((place) => place.id);
  const visitSummaries = await loadPlaceVisitSummariesForTrip(tripId, allPlaceIds);

  for (const place of [...unplannedPlaces, ...unlocatedPlaces]) {
    const visitSummary = visitSummaries.get(place.id);
    if (visitSummary) {
      place.visitSummary = visitSummary;
    }
  }

  return {
    data: {
      days,
      unplannedPlaces,
      unlocatedPlaces,
      tripSettings,
      tripAnchorDate,
      tripAnchorSource,
    },
    error: null,
  };
}

function normalizePlaceJoin(
  value: PlanningPlace | PlanningPlace[] | null,
): PlanningPlace | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
