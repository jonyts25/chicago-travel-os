"use server";

import {
  rankNearbyPoisWithAI,
  type DiscoverSuggestion,
} from "@/lib/ai/discover-places";
import { resolveDiscoverSearchCoordinates } from "@/lib/discover/resolve-discover-location";
import { loadTripGeocodingContext } from "@/lib/geocoding/load-trip-geocoding-context";
import { addPlaceFromDiscover } from "@/lib/places/add-place-from-discover";
import { queryNearbyPois } from "@/lib/overpass/query-nearby-pois";
import { assertTripMember } from "@/lib/supabase/mutation-result";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { loadSuggestionContext } from "@/lib/users/load-suggestion-context";
import { revalidatePath } from "next/cache";

export async function discoverPlacesAction(
  tripId: string,
  input: { lat: number; lng: number; query: string },
): Promise<
  | {
      ok: true;
      suggestions: DiscoverSuggestion[];
      poiCount: number;
      searchLat: number;
      searchLng: number;
      locationSource: "device" | "trip_center";
    }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "Ubicación inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return { ok: false, error: membership.error };
  }

  const { context, error: contextError } = await loadSuggestionContext(tripId);
  if (contextError || !context) {
    return { ok: false, error: contextError ?? "No se pudo cargar el contexto." };
  }

  const tripGeo = await loadTripGeocodingContext(supabase, tripId);
  const resolved = resolveDiscoverSearchCoordinates(
    { lat: input.lat, lng: input.lng },
    tripGeo,
  );

  const { pois, error: overpassError } = await queryNearbyPois({
    lat: resolved.lat,
    lng: resolved.lng,
    query: input.query,
  });

  if (overpassError) {
    return { ok: false, error: overpassError };
  }

  const { suggestions, error: aiError } = await rankNearbyPoisWithAI({
    userQuery: input.query,
    tripCity: tripGeo.base_location ?? context.baseLocation,
    travelers: context.travelers,
    pois,
  });

  if (aiError) {
    return { ok: false, error: aiError };
  }

  return {
    ok: true,
    suggestions,
    poiCount: pois.length,
    searchLat: resolved.lat,
    searchLng: resolved.lng,
    locationSource: resolved.source,
  };
}

export async function saveDiscoverPlaceAction(
  tripId: string,
  suggestion: DiscoverSuggestion,
  options: { forceDuplicate?: boolean } = {},
): Promise<
  | { ok: true; placeId: string; name: string }
  | {
      ok: false;
      error: string;
      needsConfirmation?: boolean;
      duplicateName?: string;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return { ok: false, error: membership.error };
  }

  const result = await addPlaceFromDiscover(supabase, tripId, suggestion, options);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      needsConfirmation: result.needsConfirmation,
      duplicateName: result.duplicate?.name,
    };
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }

  return {
    ok: true,
    placeId: result.placeId,
    name: result.name,
  };
}
