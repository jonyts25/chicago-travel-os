"use server";

import {
  addPlaceFromSearchSelection,
  type AddPlaceFromSearchInput,
  type AddPlaceFromSearchResult,
} from "@/lib/places/add-place-from-search";
import { parsePlaceCreationMeta } from "@/lib/places/place-classification";
import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import {
  searchPlacesWithNominatim,
  type NominatimPlaceSearchResult,
} from "@/lib/geocoding/nominatim-search";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

export type SearchPlacesActionResult =
  | { ok: true; results: NominatimPlaceSearchResult[] }
  | { ok: false; error: string; results: [] };

export async function searchPlacesAction(
  tripId: string,
  query: string,
): Promise<SearchPlacesActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión.", results: [] };
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return {
      ok: false,
      error: "Escribe al menos 2 caracteres para buscar.",
      results: [],
    };
  }

  const geocodingContext = await loadTripGeocodingContext(supabase, tripId);
  const results = await searchPlacesWithNominatim(trimmedQuery, geocodingContext);

  return { ok: true, results };
}

export async function addPlaceFromSearchAction(
  tripId: string,
  selection: AddPlaceFromSearchInput,
  options?: {
    forceDuplicate?: boolean;
    priority?: string;
    interest?: string;
  },
): Promise<AddPlaceFromSearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const classification = parsePlaceCreationMeta({
    priority: options?.priority,
    interest: options?.interest,
  });

  if (!classification.ok) {
    return { ok: false, error: classification.error };
  }

  try {
    const result = await addPlaceFromSearchSelection(supabase, tripId, selection, {
      forceDuplicate: options?.forceDuplicate,
      creationMeta: classification.meta,
    });

    if (result.ok) {
      for (const path of revalidateTripPaths(tripId)) {
        revalidatePath(path);
      }
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo agregar el lugar.";
    return { ok: false, error: message };
  }
}
