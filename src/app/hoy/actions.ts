"use server";

import {
  ITINERARY_ITEM_STATUS_DONE,
  ITINERARY_ITEM_STATUS_SKIPPED,
  type TodayDayData,
} from "@/lib/hoy/today-types";
import {
  loadTodayDayData,
  loadTodayPageContext,
  resolveDayNumberForItem,
} from "@/lib/hoy/load-today-data";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
import { revalidatePath } from "next/cache";

export async function loadTodayDayAction(
  tripId: string,
  dayNumber: number,
): Promise<{ ok: true; data: TodayDayData } | { ok: false; error: string }> {
  const { data, error } = await loadTodayDayData(tripId, dayNumber);

  if (error || !data) {
    return { ok: false, error: error ?? "No se pudo cargar el día." };
  }

  return { ok: true, data };
}

export async function updateTodayBlockStatusAction(
  tripId: string,
  itemId: string,
  status: typeof ITINERARY_ITEM_STATUS_DONE | typeof ITINERARY_ITEM_STATUS_SKIPPED,
): Promise<
  | { ok: true; data: TodayDayData }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const dayNumber = await resolveDayNumberForItem(tripId, itemId);
  if (!dayNumber) {
    return { ok: false, error: "Bloque no encontrado." };
  }

  const { data: item, error: itemError } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_days!inner(trip_id)")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) {
    return { ok: false, error: itemError.message };
  }

  const dayJoin = item?.itinerary_days as { trip_id: string } | { trip_id: string }[] | undefined;
  const itemTripId = Array.isArray(dayJoin) ? dayJoin[0]?.trip_id : dayJoin?.trip_id;

  if (!item || itemTripId !== tripId) {
    return { ok: false, error: "Bloque no válido para este viaje." };
  }

  const { error: updateError } = await supabase
    .from("itinerary_items")
    .update({ status })
    .eq("id", itemId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }

  const refreshed = await loadTodayDayData(tripId, dayNumber);
  if (refreshed.error || !refreshed.data) {
    return { ok: false, error: refreshed.error ?? "No se pudo refrescar el día." };
  }

  return { ok: true, data: refreshed.data };
}

export async function getTodayBootstrapAction(tripId: string): Promise<
  | {
      ok: true;
      context: Awaited<ReturnType<typeof loadTodayPageContext>>["context"];
    }
  | { ok: false; error: string }
> {
  const { context, error } = await loadTodayPageContext(tripId);

  if (error || !context) {
    return { ok: false, error: error ?? "No se pudo cargar el contexto." };
  }

  return { ok: true, context };
}
