"use server";

import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_PLANNED,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import {
  runFullItineraryOptimizer,
  runSingleDayItineraryOptimizer,
} from "@/lib/itinerary/optimizer/run-optimizer";
import type { OptimizerSummary } from "@/lib/itinerary/optimizer/types";
import { revalidatePath } from "next/cache";

export type PlanningActionResult = {
  ok: boolean;
  error?: string;
};

export async function assignPlaceToDayAction(
  placeId: string,
  itineraryDayId: string,
): Promise<PlanningActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("id, status")
    .eq("id", placeId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (placeError) {
    return { ok: false, error: placeError.message };
  }

  if (!place) {
    return { ok: false, error: "Lugar no encontrado." };
  }

  if (place.status !== PLACE_STATUS_UNPLANNED) {
    return { ok: false, error: "Ese lugar ya está planificado." };
  }

  const { data: day, error: dayError } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("id", itineraryDayId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (dayError) {
    return { ok: false, error: dayError.message };
  }

  if (!day) {
    return { ok: false, error: "Día no encontrado." };
  }

  const { data: lastItem, error: lastItemError } = await supabase
    .from("itinerary_items")
    .select("order_index")
    .eq("itinerary_day_id", itineraryDayId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastItemError) {
    return { ok: false, error: lastItemError.message };
  }

  const nextOrderIndex =
    typeof lastItem?.order_index === "number" ? lastItem.order_index + 1 : 0;

  const { error: insertError } = await supabase.from("itinerary_items").insert({
    itinerary_day_id: itineraryDayId,
    place_id: placeId,
    order_index: nextOrderIndex,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: updateError } = await supabase
    .from("places")
    .update({ status: PLACE_STATUS_PLANNED })
    .eq("id", placeId)
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (updateError) {
    await supabase
      .from("itinerary_items")
      .delete()
      .eq("itinerary_day_id", itineraryDayId)
      .eq("place_id", placeId);

    return { ok: false, error: updateError.message };
  }

  revalidatePath("/planificar");
  return { ok: true };
}

export async function removePlaceFromDayAction(
  itineraryItemId: string,
): Promise<PlanningActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: item, error: itemError } = await supabase
    .from("itinerary_items")
    .select("id, place_id, itinerary_day_id, is_fixed")
    .eq("id", itineraryItemId)
    .maybeSingle();

  if (itemError) {
    return { ok: false, error: itemError.message };
  }

  if (!item) {
    return { ok: false, error: "Elemento del itinerario no encontrado." };
  }

  if (item.is_fixed) {
    return { ok: false, error: "Este lugar está fijado y no se puede quitar." };
  }

  const { data: day, error: dayError } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("id", item.itinerary_day_id)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (dayError) {
    return { ok: false, error: dayError.message };
  }

  if (!day) {
    return { ok: false, error: "Día no válido para este viaje." };
  }

  const { error: deleteError } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itineraryItemId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const { error: updateError } = await supabase
    .from("places")
    .update({ status: PLACE_STATUS_UNPLANNED })
    .eq("id", item.place_id)
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/planificar");
  return { ok: true };
}

export async function moveItineraryItemAction(
  itineraryItemId: string,
  direction: "up" | "down",
): Promise<PlanningActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: current, error: currentError } = await supabase
    .from("itinerary_items")
    .select("id, order_index, itinerary_day_id, is_fixed")
    .eq("id", itineraryItemId)
    .maybeSingle();

  if (currentError) {
    return { ok: false, error: currentError.message };
  }

  if (!current) {
    return { ok: false, error: "Elemento del itinerario no encontrado." };
  }

  if (current.is_fixed) {
    return { ok: false, error: "Este lugar está fijado y no se puede reordenar." };
  }

  const { data: day, error: dayError } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("id", current.itinerary_day_id)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (dayError) {
    return { ok: false, error: dayError.message };
  }

  if (!day) {
    return { ok: false, error: "Día no válido para este viaje." };
  }

  let neighborResult;

  if (direction === "up") {
    neighborResult = await supabase
      .from("itinerary_items")
      .select("id, order_index")
      .eq("itinerary_day_id", current.itinerary_day_id)
      .lt("order_index", current.order_index)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
  } else {
    neighborResult = await supabase
      .from("itinerary_items")
      .select("id, order_index")
      .eq("itinerary_day_id", current.itinerary_day_id)
      .gt("order_index", current.order_index)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  const { data: neighbor, error: neighborError } = neighborResult;

  if (neighborError) {
    return { ok: false, error: neighborError.message };
  }

  if (!neighbor) {
    return { ok: true };
  }

  const currentOrder = current.order_index;
  const neighborOrder = neighbor.order_index;

  const { error: updateCurrentError } = await supabase
    .from("itinerary_items")
    .update({ order_index: neighborOrder })
    .eq("id", current.id);

  if (updateCurrentError) {
    return { ok: false, error: updateCurrentError.message };
  }

  const { error: updateNeighborError } = await supabase
    .from("itinerary_items")
    .update({ order_index: currentOrder })
    .eq("id", neighbor.id);

  if (updateNeighborError) {
    await supabase
      .from("itinerary_items")
      .update({ order_index: currentOrder })
      .eq("id", current.id);

    return { ok: false, error: updateNeighborError.message };
  }

  revalidatePath("/planificar");
  return { ok: true };
}

export async function generateItineraryAction(): Promise<OptimizerSummary> {
  const result = await runFullItineraryOptimizer();
  if (result.ok) {
    revalidatePath("/planificar");
  }
  return result;
}

export async function regenerateDayItineraryAction(
  itineraryDayId: string,
): Promise<OptimizerSummary> {
  const result = await runSingleDayItineraryOptimizer(itineraryDayId);
  if (result.ok) {
    revalidatePath("/planificar");
  }
  return result;
}
