import { CHICAGO_TRIP_ID } from "@/lib/constants";
import {
  resolveDayConstraints,
  type ItineraryDayConstraintsInput,
  type TripDayConstraintsInput,
} from "@/lib/itinerary/day-constraints";
import { createClient } from "@/lib/supabase/server";

export async function loadDayEndWarningMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itineraryDayId: string,
): Promise<number> {
  const [{ data: day, error: dayError }, { data: trip, error: tripError }, { data: allDays, error: daysError }] =
    await Promise.all([
      supabase
        .from("itinerary_days")
        .select("id, day_number, date, focus, day_end_override")
        .eq("id", itineraryDayId)
        .maybeSingle(),
      supabase
        .from("trips")
        .select("flight_departure, airport_transfer_minutes")
        .eq("id", CHICAGO_TRIP_ID)
        .maybeSingle(),
      supabase
        .from("itinerary_days")
        .select("id, day_number, date, focus, day_end_override")
        .eq("trip_id", CHICAGO_TRIP_ID)
        .order("day_number", { ascending: true }),
    ]);

  if (dayError || tripError || daysError || !day) {
    return 22 * 60;
  }

  const tripConstraints: TripDayConstraintsInput = {
    flightDeparture: trip?.flight_departure ?? null,
    airportTransferMinutes: trip?.airport_transfer_minutes ?? 90,
  };

  const dayInputs = (allDays ?? []).map(
    (row): ItineraryDayConstraintsInput => ({
      id: row.id,
      dayNumber: row.day_number,
      date: row.date,
      focus: row.focus,
      dayEndOverride: row.day_end_override,
    }),
  );

  const currentDay: ItineraryDayConstraintsInput = {
    id: day.id,
    dayNumber: day.day_number,
    date: day.date,
    focus: day.focus,
    dayEndOverride: day.day_end_override,
  };

  return resolveDayConstraints(currentDay, tripConstraints, dayInputs).dayEndMinutes;
}
