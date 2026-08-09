import type { ItineraryDay } from "@/lib/itinerary/schema";
import {
  resolveDayCalendarDate,
  resolveTripAnchorDate,
  type TripCalendarAnchorInput,
} from "@/lib/trips/trip-calendar";
import { createClient } from "@/lib/supabase/server";

export async function syncItineraryDayDatesFromAnchor(
  tripId: string,
  days: ItineraryDay[],
  anchorInput: TripCalendarAnchorInput,
): Promise<{ days: ItineraryDay[]; error: string | null }> {
  const anchorDate = resolveTripAnchorDate(anchorInput);
  if (!anchorDate) {
    return { days, error: null };
  }

  const supabase = await createClient();
  const updatedDays = [...days];
  let hasChanges = false;

  for (let index = 0; index < updatedDays.length; index += 1) {
    const day = updatedDays[index];
    if (day.date?.trim()) {
      continue;
    }

    const computedDate = resolveDayCalendarDate(anchorDate, day.day_number);
    if (!computedDate) {
      continue;
    }

    const { error } = await supabase
      .from("itinerary_days")
      .update({ date: computedDate })
      .eq("id", day.id)
      .eq("trip_id", tripId);

    if (error) {
      return { days, error: error.message };
    }

    updatedDays[index] = { ...day, date: computedDate };
    hasChanges = true;
  }

  if (!hasChanges) {
    return { days, error: null };
  }

  return { days: updatedDays, error: null };
}
