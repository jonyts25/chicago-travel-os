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
import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function loadTodayDayAction(
  dayNumber: number,
): Promise<{ ok: true; data: TodayDayData } | { ok: false; error: string }> {
  const { data, error } = await loadTodayDayData(dayNumber);

  if (error || !data) {
    return { ok: false, error: error ?? "No se pudo cargar el día." };
  }

  return { ok: true, data };
}

export async function updateTodayBlockStatusAction(
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

  const dayNumber = await resolveDayNumberForItem(itemId);
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
  const tripId = Array.isArray(dayJoin) ? dayJoin[0]?.trip_id : dayJoin?.trip_id;

  if (!item || tripId !== CHICAGO_TRIP_ID) {
    return { ok: false, error: "Bloque no válido para este viaje." };
  }

  const { error: updateError } = await supabase
    .from("itinerary_items")
    .update({ status })
    .eq("id", itemId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/hoy");
  revalidatePath("/planificar");

  const refreshed = await loadTodayDayData(dayNumber);
  if (refreshed.error || !refreshed.data) {
    return { ok: false, error: refreshed.error ?? "No se pudo refrescar el día." };
  }

  return { ok: true, data: refreshed.data };
}

export async function getTodayBootstrapAction(): Promise<
  | {
      ok: true;
      context: Awaited<ReturnType<typeof loadTodayPageContext>>["context"];
    }
  | { ok: false; error: string }
> {
  const { context, error } = await loadTodayPageContext();

  if (error || !context) {
    return { ok: false, error: error ?? "No se pudo cargar el contexto." };
  }

  return { ok: true, context };
}
