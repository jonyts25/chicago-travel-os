import { PLACE_STATUS_UNPLANNED } from "@/lib/constants";
import type { DiscoverSuggestion } from "@/lib/ai/discover-places";
import type { PlaceCategory } from "@/lib/importers/types";
import {
  findNearbyDuplicate,
  type NearbyDuplicateMatch,
  type NearbyPlaceRecord,
} from "@/lib/places/nearby-duplicate";
import type { PlaceInsert } from "@/lib/places/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AddPlaceFromDiscoverResult =
  | {
      ok: true;
      placeId: string;
      name: string;
    }
  | {
      ok: false;
      error: string;
      duplicate?: NearbyDuplicateMatch;
      needsConfirmation?: boolean;
    };

const CATEGORY_MAP: Record<string, PlaceCategory> = {
  Restaurante: "Restaurante",
  Café: "Café",
  Bar: "Otro",
  Museo: "Museo",
  Atracción: "Atracción",
  Parque: "Otro",
  Compras: "Compras",
  Postres: "Otro",
  Otro: "Otro",
};

export async function addPlaceFromDiscover(
  supabase: SupabaseClient,
  tripId: string,
  suggestion: DiscoverSuggestion,
  options: { forceDuplicate?: boolean } = {},
): Promise<AddPlaceFromDiscoverResult> {
  const name = suggestion.name.trim();
  if (!name) {
    return { ok: false, error: "La sugerencia no tiene nombre." };
  }

  if (!Number.isFinite(suggestion.lat) || !Number.isFinite(suggestion.lng)) {
    return { ok: false, error: "La sugerencia no tiene coordenadas válidas." };
  }

  const existingPlaces = await loadExistingPlacesWithCoordinates(supabase, tripId);
  const duplicate = findNearbyDuplicate(
    { name, lat: suggestion.lat, lng: suggestion.lng },
    existingPlaces,
  );

  if (duplicate && !options.forceDuplicate) {
    return {
      ok: false,
      error: `Ya existe "${duplicate.name}" a ${Math.round(duplicate.distanceMeters)} m.`,
      duplicate,
      needsConfirmation: true,
    };
  }

  const category = CATEGORY_MAP[suggestion.category] ?? "Otro";
  const notes = suggestion.reason ? `Descubrir: ${suggestion.reason}` : null;

  const row: PlaceInsert = {
    trip_id: tripId,
    name,
    lat: suggestion.lat,
    lng: suggestion.lng,
    address: null,
    google_place_id: null,
    maps_url: null,
    notes,
    category,
    duration_minutes: null,
    status: PLACE_STATUS_UNPLANNED,
  };

  const { data, error } = await supabase
    .from("places")
    .insert(row)
    .select("id, name")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    placeId: data.id,
    name: data.name,
  };
}

async function loadExistingPlacesWithCoordinates(
  supabase: SupabaseClient,
  tripId: string,
): Promise<NearbyPlaceRecord[]> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, lat, lng")
    .eq("trip_id", tripId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
  }>)
    .filter(
      (place): place is NearbyPlaceRecord =>
        place.lat != null &&
        place.lng != null &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lng),
    )
    .map((place) => ({
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
    }));
}
