import { applyAIEnrichment, enrichPlacesWithAI } from "@/lib/ai/enrich-places";
import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import type { NominatimPlaceSearchResult } from "@/lib/geocoding/nominatim-search";
import {
  findNearbyDuplicate,
  type NearbyDuplicateMatch,
  type NearbyPlaceRecord,
} from "@/lib/places/nearby-duplicate";
import type { PlaceCategory } from "@/lib/importers/types";
import type { PlaceInsert } from "@/lib/places/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AddPlaceFromSearchInput = Pick<
  NominatimPlaceSearchResult,
  "name" | "address" | "lat" | "lng"
>;

export type AddPlaceFromSearchResult =
  | {
      ok: true;
      placeId: string;
      name: string;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      duplicate?: NearbyDuplicateMatch;
      needsConfirmation?: boolean;
      warnings?: string[];
    };

export async function addPlaceFromSearchSelection(
  supabase: SupabaseClient,
  selection: AddPlaceFromSearchInput,
  options: { forceDuplicate?: boolean } = {},
): Promise<AddPlaceFromSearchResult> {
  const name = selection.name.trim();
  if (!name) {
    return { ok: false, error: "El lugar seleccionado no tiene nombre." };
  }

  if (!Number.isFinite(selection.lat) || !Number.isFinite(selection.lng)) {
    return { ok: false, error: "El lugar seleccionado no tiene coordenadas válidas." };
  }

  const existingPlaces = await loadExistingPlacesWithCoordinates(supabase);
  const duplicate = findNearbyDuplicate(
    {
      name,
      lat: selection.lat,
      lng: selection.lng,
    },
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

  const parsedPlace = {
    name,
    lat: selection.lat,
    lng: selection.lng,
    address: selection.address.trim() || null,
    google_place_id: null,
    maps_url: null,
    notes: null as string | null,
    category: null as PlaceCategory | null,
    duration_minutes: null as number | null,
  };

  const warnings: string[] = [];
  const { enrichments, errors: aiErrors } = await enrichPlacesWithAI([
    { name: parsedPlace.name },
  ]);
  warnings.push(...aiErrors);

  const enrichment = enrichments.get(parsedPlace.name);
  applyAIEnrichment(parsedPlace, enrichment);

  const row: PlaceInsert = {
    trip_id: CHICAGO_TRIP_ID,
    name: parsedPlace.name,
    lat: parsedPlace.lat,
    lng: parsedPlace.lng,
    address: parsedPlace.address,
    google_place_id: parsedPlace.google_place_id,
    maps_url: parsedPlace.maps_url,
    notes: parsedPlace.notes,
    category: parsedPlace.category,
    duration_minutes: parsedPlace.duration_minutes,
    status: PLACE_STATUS_UNPLANNED,
  };

  const { data, error } = await supabase
    .from("places")
    .insert(row)
    .select("id, name")
    .single();

  if (error) {
    return { ok: false, error: error.message, warnings };
  }

  return {
    ok: true,
    placeId: data.id,
    name: data.name,
    warnings,
  };
}

async function loadExistingPlacesWithCoordinates(
  supabase: SupabaseClient,
): Promise<NearbyPlaceRecord[]> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, lat, lng")
    .eq("trip_id", CHICAGO_TRIP_ID);

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
