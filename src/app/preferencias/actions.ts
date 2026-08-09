"use server";

import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
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

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({ preferences: normalized })
      .eq("id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("users").insert({
      id: user.id,
      preferences: normalized,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/preferencias");
  revalidatePath("/planificar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTripSettingsAction(
  flightDeparture: string | null,
  airportTransferMinutes: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  if (!Number.isFinite(airportTransferMinutes) || airportTransferMinutes < 0) {
    return { ok: false, error: "Los minutos de traslado deben ser un número válido." };
  }

  const { error } = await supabase
    .from("trips")
    .update({
      flight_departure: flightDeparture,
      airport_transfer_minutes: airportTransferMinutes,
    })
    .eq("id", CHICAGO_TRIP_ID);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/preferencias");
  revalidatePath("/planificar");
  revalidatePath("/dashboard");
  return { ok: true };
}
