"use server";

import { extractTravelConfirmation } from "@/lib/ai/extract-travel-confirmation";
import type {
  ExtractedTravelConfirmation,
  TripTravelSettingsUpdate,
} from "@/lib/trips/travel-info";
import { assertTripMember, interpretMutationResult } from "@/lib/supabase/mutation-result";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

export async function getUserPreferencesAction(): Promise<
  | { ok: true; preferences: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, preferences: data?.preferences ?? null };
}

export async function updateUserPreferencesAction(
  preferences: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const normalized = preferences.trim() || null;

  const { data, error } = await supabase
    .from("users")
    .update({
      preferences: normalized,
    })
    .eq("id", user.id)
    .select("id")
    .single();

  const mutation = interpretMutationResult(data, error, {
    table: "users",
    action: "update",
    permissionHint:
      "Tu fila en users necesita políticas RLS de SELECT y UPDATE para auth.uid() = id.",
  });

  if (!mutation.ok) {
    return mutation;
  }

  revalidatePath("/preferencias");
  revalidatePath("/planificar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTripSettingsAction(
  tripId: string,
  settings: TripTravelSettingsUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  if (
    !Number.isFinite(settings.airport_transfer_minutes) ||
    settings.airport_transfer_minutes < 0
  ) {
    return { ok: false, error: "Los minutos de traslado deben ser un número válido." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return membership;
  }

  const { data, error } = await supabase
    .from("trips")
    .update({
      start_date: settings.start_date,
      flight_arrival: settings.flight_arrival,
      flight_departure: settings.flight_departure,
      flight_outbound_number: settings.flight_outbound_number?.trim() || null,
      flight_return_number: settings.flight_return_number?.trim() || null,
      hotel_checkin: settings.hotel_checkin,
      hotel_checkout: settings.hotel_checkout,
      base_location: settings.base_location?.trim() || null,
      airport_transfer_minutes: settings.airport_transfer_minutes,
    })
    .eq("id", tripId)
    .select("id")
    .single();

  const mutation = interpretMutationResult(data, error, {
    table: "trips",
    action: "update",
    permissionHint:
      "Los miembros del viaje necesitan políticas RLS de SELECT y UPDATE en trips (ver supabase/migrations/20260809143000_fix_preferencias_save_rls.sql).",
  });

  if (!mutation.ok) {
    return mutation;
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }
  return { ok: true };
}

export async function extractTravelConfirmationAction(
  confirmationText: string,
): Promise<
  | { ok: true; data: ExtractedTravelConfirmation }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data, error } = await extractTravelConfirmation(confirmationText);
  if (error || !data) {
    return { ok: false, error: error ?? "No se pudieron extraer datos." };
  }

  return { ok: true, data };
}
