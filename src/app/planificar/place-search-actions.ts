"use server";

import {
  addPlaceFromSearchSelection,
  type AddPlaceFromSearchInput,
  type AddPlaceFromSearchResult,
} from "@/lib/places/add-place-from-search";
import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import {
  searchPlacesWithNominatim,
  type NominatimPlaceSearchResult,
} from "@/lib/geocoding/nominatim-search";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SearchPlacesActionResult =
  | { ok: true; results: NominatimPlaceSearchResult[] }
  | { ok: false; error: string; results: [] };

export async function searchPlacesAction(
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

  const geocodingContext = await loadTripGeocodingContext(supabase);
  const results = await searchPlacesWithNominatim(trimmedQuery, geocodingContext);

  return { ok: true, results };
}

export async function addPlaceFromSearchAction(
  selection: AddPlaceFromSearchInput,
  options?: { forceDuplicate?: boolean },
): Promise<AddPlaceFromSearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  try {
    const result = await addPlaceFromSearchSelection(supabase, selection, options);

    if (result.ok) {
      revalidatePath("/planificar");
      revalidatePath("/planificar/lugares");
      revalidatePath("/map");
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo agregar el lugar.";
    return { ok: false, error: message };
  }
}
