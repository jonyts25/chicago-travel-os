import { CHICAGO_TRIP_ID } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeTripGeocodingContext,
  TRIP_GEOCODING_SELECT,
  type TripGeocodingContext,
} from "@/lib/geocoding/trip-geocoding-context";

export async function loadTripGeocodingContext(
  supabase: SupabaseClient,
  tripId: string = CHICAGO_TRIP_ID,
): Promise<TripGeocodingContext> {
  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_GEOCODING_SELECT)
    .eq("id", tripId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load trip geocoding context:", error.message);
    return normalizeTripGeocodingContext(null);
  }

  return normalizeTripGeocodingContext(data);
}
