"use server";

import { assertTripMember } from "@/lib/supabase/mutation-result";
import type { PlaceVisit } from "@/lib/places/place-visits";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

export async function getPlaceVisitForUserAction(
  tripId: string,
  placeId: string,
): Promise<{ ok: true; visit: PlaceVisit | null } | { ok: false; error: string }> {
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

  const placeCheck = await supabase
    .from("places")
    .select("id")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (placeCheck.error) {
    return { ok: false, error: placeCheck.error.message };
  }

  if (!placeCheck.data) {
    return { ok: false, error: "Lugar no encontrado en este viaje." };
  }

  const { data, error } = await supabase
    .from("place_visits")
    .select("id, place_id, user_id, visited_at, rating, notes")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: true, visit: null };
  }

  return {
    ok: true,
    visit: {
      id: data.id,
      place_id: data.place_id,
      user_id: data.user_id,
      visited_at: data.visited_at,
      rating: data.rating,
      notes: data.notes,
    },
  };
}

export async function savePlaceVisitAction(
  tripId: string,
  placeId: string,
  input: { rating: number; notes: string },
): Promise<{ ok: true; visit: PlaceVisit } | { ok: false; error: string }> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "La calificación debe ser entre 1 y 5." };
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

  const placeCheck = await supabase
    .from("places")
    .select("id")
    .eq("id", placeId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (placeCheck.error) {
    return { ok: false, error: placeCheck.error.message };
  }

  if (!placeCheck.data) {
    return { ok: false, error: "Lugar no encontrado en este viaje." };
  }

  const notes = input.notes.trim() || null;

  const existing = await supabase
    .from("place_visits")
    .select("id")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) {
    return { ok: false, error: existing.error.message };
  }

  if (existing.data) {
    const { data, error } = await supabase
      .from("place_visits")
      .update({
        rating: input.rating,
        notes,
        visited_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("id, place_id, user_id, visited_at, rating, notes")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    for (const path of revalidateTripPaths(tripId)) {
      revalidatePath(path);
    }

    return {
      ok: true,
      visit: {
        id: data.id,
        place_id: data.place_id,
        user_id: data.user_id,
        visited_at: data.visited_at,
        rating: data.rating,
        notes: data.notes,
      },
    };
  }

  const { data, error } = await supabase
    .from("place_visits")
    .insert({
      place_id: placeId,
      user_id: user.id,
      rating: input.rating,
      notes,
    })
    .select("id, place_id, user_id, visited_at, rating, notes")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }

  return {
    ok: true,
    visit: {
      id: data.id,
      place_id: data.place_id,
      user_id: data.user_id,
      visited_at: data.visited_at,
      rating: data.rating,
      notes: data.notes,
    },
  };
}
