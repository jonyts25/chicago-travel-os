import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import { geocodePlaceWithRetries } from "@/lib/geocoding/nominatim";
import type { TripGeocodingContext } from "@/lib/geocoding/trip-geocoding-context";
import { hasCoordinates } from "@/lib/places/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GeocodePlaceRecordResult =
  | { ok: true; lat: number; lng: number; address: string | null }
  | { ok: false; error: string };

export async function geocodePlaceRecord(
  supabase: SupabaseClient,
  place: { id: string; name: string },
  geocodingContext: TripGeocodingContext,
  tripId: string,
): Promise<GeocodePlaceRecordResult> {
  const geocoded = await geocodePlaceWithRetries(place.name, geocodingContext);

  if (!hasCoordinates(geocoded)) {
    return {
      ok: false,
      error: "Nominatim no encontró coordenadas para este nombre.",
    };
  }

  const { error: updateError } = await supabase
    .from("places")
    .update({
      lat: geocoded.lat,
      lng: geocoded.lng,
      address: geocoded.address,
    })
    .eq("id", place.id)
    .eq("trip_id", tripId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return {
    ok: true,
    lat: geocoded.lat,
    lng: geocoded.lng,
    address: geocoded.address,
  };
}

export async function geocodePlaceById(
  supabase: SupabaseClient,
  placeId: string,
  tripId: string,
): Promise<GeocodePlaceRecordResult> {
  const { data: place, error: fetchError } = await supabase
    .from("places")
    .select("id, name")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (!place) {
    return { ok: false, error: "Lugar no encontrado." };
  }

  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);
  return geocodePlaceRecord(supabase, place, geocodingContext, tripId);
}
