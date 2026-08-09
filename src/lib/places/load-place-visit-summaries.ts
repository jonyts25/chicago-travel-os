import { summarizePlaceVisits, type PlaceVisitSummary } from "@/lib/places/place-visits";
import { createClient } from "@/lib/supabase/server";

export async function loadPlaceVisitSummariesForTrip(
  tripId: string,
  placeIds: string[],
): Promise<Map<string, PlaceVisitSummary>> {
  if (placeIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("place_visits")
    .select("place_id, rating")
    .in("place_id", placeIds);

  if (error) {
    console.error("loadPlaceVisitSummariesForTrip:", error.message);
    return new Map();
  }

  const rows = (data ?? []).map((row) => ({
    place_id: row.place_id as string,
    rating: row.rating as number | null,
  }));

  return summarizePlaceVisits(rows);
}
