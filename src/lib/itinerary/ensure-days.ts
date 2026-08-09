import { TRIP_DAY_COUNT } from "@/lib/constants";
import type { ItineraryDay } from "@/lib/itinerary/schema";
import { createClient } from "@/lib/supabase/server";

export async function ensureItineraryDays(
  tripId: string,
): Promise<{ days: ItineraryDay[]; error: string | null }> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("itinerary_days")
    .select("id, trip_id, day_number, date, focus, day_end_override")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true });

  if (fetchError) {
    return { days: [], error: fetchError.message };
  }

  const existingDays = (existing ?? []) as ItineraryDay[];
  const existingNumbers = new Set(existingDays.map((day) => day.day_number));

  const missingRows: { trip_id: string; day_number: number; date: null }[] = [];
  for (let dayNumber = 1; dayNumber <= TRIP_DAY_COUNT; dayNumber += 1) {
    if (!existingNumbers.has(dayNumber)) {
      missingRows.push({
        trip_id: tripId,
        day_number: dayNumber,
        date: null,
      });
    }
  }

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from("itinerary_days")
      .insert(missingRows);

    if (insertError) {
      return { days: existingDays, error: insertError.message };
    }
  }

  if (missingRows.length === 0) {
    return { days: existingDays, error: null };
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("itinerary_days")
    .select("id, trip_id, day_number, date, focus, day_end_override")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true });

  if (refreshError) {
    return { days: existingDays, error: refreshError.message };
  }

  return { days: (refreshed ?? []) as ItineraryDay[], error: null };
}
