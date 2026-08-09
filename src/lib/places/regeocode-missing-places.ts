import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import { NOMINATIM_DELAY_MS } from "@/lib/geocoding/nominatim";
import { geocodePlaceRecord } from "@/lib/places/geocode-place";
import { hasCoordinates } from "@/lib/places/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RegeocodeMissingPlacesResult = {
  ok: boolean;
  total: number;
  resolved: number;
  failed: string[];
  errors: string[];
};

type PlaceRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

export async function countMissingCoordinatesPlaces(
  supabase: SupabaseClient,
  tripId: string = CHICAGO_TRIP_ID,
): Promise<number> {
  const places = await loadMissingCoordinatePlaces(supabase, tripId);
  return places.length;
}

export async function regeocodeMissingPlaces(
  supabase: SupabaseClient,
  tripId: string = CHICAGO_TRIP_ID,
): Promise<RegeocodeMissingPlacesResult> {
  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);
  const places = await loadMissingCoordinatePlaces(supabase, tripId);

  if (places.length === 0) {
    return {
      ok: true,
      total: 0,
      resolved: 0,
      failed: [],
      errors: [],
    };
  }

  let resolved = 0;
  const failed: string[] = [];
  const errors: string[] = [];

  for (let index = 0; index < places.length; index += 1) {
    const place = places[index]!;
    const result = await geocodePlaceRecord(
      supabase,
      place,
      geocodingContext,
      tripId,
    );

    if (result.ok) {
      resolved += 1;
    } else {
      failed.push(place.name);
      errors.push(`${place.name}: ${result.error}`);
    }

    if (index < places.length - 1) {
      await delay(NOMINATIM_DELAY_MS);
    }
  }

  return {
    ok: resolved > 0 || failed.length === 0,
    total: places.length,
    resolved,
    failed,
    errors,
  };
}

async function loadMissingCoordinatePlaces(
  supabase: SupabaseClient,
  tripId: string,
): Promise<PlaceRow[]> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, lat, lng")
    .eq("trip_id", tripId)
    .order("name");

  if (error) {
    throw new Error(`Error al leer lugares sin coordenadas: ${error.message}`);
  }

  return ((data ?? []) as PlaceRow[]).filter((place) => !hasCoordinates(place));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
