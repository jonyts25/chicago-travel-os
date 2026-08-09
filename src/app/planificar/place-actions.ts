"use server";

import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_PLANNED,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { geocodePlaceById } from "@/lib/places/geocode-place";
import { recalculateDayScheduleForPlace } from "@/lib/itinerary/recalculate-day-schedule";
import type {
  PlaceDetail,
  PlaceMutationResult,
  UpdatePlaceInput,
} from "@/lib/places/place-detail";
import { timeInputToDbValue } from "@/lib/places/place-format";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidatePlaceViews(): void {
  revalidatePath("/planificar");
  revalidatePath("/planificar/lugares");
  revalidatePath("/map");
}

export async function getPlaceDetailAction(
  placeId: string,
): Promise<{ ok: true; place: PlaceDetail } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select(
      "id, name, category, priority, interest, duration_minutes, notes, reservation_required, opening_hours, lat, lng, address, status, maps_url",
    )
    .eq("id", placeId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (placeError) {
    return { ok: false, error: placeError.message };
  }

  if (!place) {
    return { ok: false, error: "Lugar no encontrado." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_day_id, start_time, is_fixed")
    .eq("place_id", placeId)
    .order("order_index", { ascending: true })
    .limit(1);

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  const itemRow = items?.[0] ?? null;
  let itinerary: PlaceDetail["itinerary"] = null;

  if (itemRow) {
    const { data: day, error: dayError } = await supabase
      .from("itinerary_days")
      .select("day_number")
      .eq("id", itemRow.itinerary_day_id)
      .eq("trip_id", CHICAGO_TRIP_ID)
      .maybeSingle();

    if (dayError) {
      return { ok: false, error: dayError.message };
    }

    if (day) {
      itinerary = {
        itemId: itemRow.id,
        itineraryDayId: itemRow.itinerary_day_id,
        dayNumber: day.day_number,
        startTime: itemRow.start_time,
        isFixed: Boolean(itemRow.is_fixed),
      };
    }
  }

  return {
    ok: true,
    place: {
      id: place.id,
      name: place.name,
      category: place.category,
      priority: place.priority,
      interest: place.interest,
      duration_minutes: place.duration_minutes,
      notes: place.notes,
      reservation_required: Boolean(place.reservation_required),
      opening_hours: place.opening_hours,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      status: place.status,
      maps_url: place.maps_url,
      itinerary,
    },
  };
}

export async function updatePlaceAction(
  input: UpdatePlaceInput,
): Promise<PlaceMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { ok: false, error: "El nombre es obligatorio." };
  }

  if (input.reservation_required && !input.reservation_start_time) {
    return {
      ok: false,
      error: "Indica la hora de la reserva fija.",
    };
  }

  const { data: existingPlace, error: fetchError } = await supabase
    .from("places")
    .select("id, status")
    .eq("id", input.placeId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (!existingPlace) {
    return { ok: false, error: "Lugar no encontrado." };
  }

  const isUnplanned = existingPlace.status === PLACE_STATUS_UNPLANNED;

  if (
    input.reservation_required &&
    isUnplanned &&
    !input.assign_to_day_id
  ) {
    return {
      ok: false,
      error: "Selecciona a qué día asignar la reserva fija.",
    };
  }

  const placePayload = {
    name: trimmedName,
    category: input.category || null,
    priority: input.priority || null,
    interest: input.interest || null,
    duration_minutes: input.duration_minutes,
    notes: input.notes?.trim() || null,
    reservation_required: input.reservation_required,
    opening_hours: input.opening_hours?.trim() || null,
  };

  const { error: updatePlaceError } = await supabase
    .from("places")
    .update(placePayload)
    .eq("id", input.placeId)
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (updatePlaceError) {
    return { ok: false, error: updatePlaceError.message };
  }

  const normalizedReservationTime = input.reservation_required
    ? normalizeReservationTime(input.reservation_start_time)
    : null;

  if (input.reservation_required && !normalizedReservationTime) {
    return {
      ok: false,
      error: "Indica una hora válida (HH:MM).",
    };
  }

  const reservationResult = await syncReservationItineraryItem(supabase, {
    placeId: input.placeId,
    reservationRequired: input.reservation_required,
    reservationStartTime: normalizedReservationTime,
    assignToDayId: input.assign_to_day_id,
    isUnplanned,
  });

  if (!reservationResult.ok) {
    return reservationResult;
  }

  const scheduleResult = await recalculateDayScheduleForPlace(supabase, input.placeId);
  if (!scheduleResult.ok) {
    return { ok: false, error: scheduleResult.error };
  }

  revalidatePlaceViews();
  return { ok: true };
}

export async function retryPlaceGeocodingAction(
  placeId: string,
): Promise<PlaceMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const result = await geocodePlaceById(supabase, placeId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePlaceViews();
  return { ok: true };
}

export async function deletePlaceAction(placeId: string): Promise<PlaceMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", placeId)
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePlaceViews();
  return { ok: true };
}

function normalizeReservationTime(value: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = timeInputToDbValue(value) ?? timeInputToDbValue(toTimeOnlyFromDb(value));
  return normalized;
}

function toTimeOnlyFromDb(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return value;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

async function syncReservationItineraryItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    placeId: string;
    reservationRequired: boolean;
    reservationStartTime: string | null;
    assignToDayId: string | null;
    isUnplanned: boolean;
  },
): Promise<PlaceMutationResult> {
  const { data: existingItems, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_day_id, order_index")
    .eq("place_id", options.placeId)
    .order("order_index", { ascending: true });

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  const existingItem = existingItems?.[0] ?? null;

  if (!options.reservationRequired) {
    if (existingItem) {
      const { error } = await supabase
        .from("itinerary_items")
        .update({ is_fixed: false, start_time: null })
        .eq("id", existingItem.id);

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    return { ok: true };
  }

  const startTime = options.reservationStartTime;
  if (!startTime) {
    return { ok: false, error: "Falta la hora de reserva." };
  }

  if (existingItem) {
    const { error } = await supabase
      .from("itinerary_items")
      .update({
        is_fixed: true,
        start_time: startTime,
      })
      .eq("id", existingItem.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { error: statusError } = await supabase
      .from("places")
      .update({ status: PLACE_STATUS_PLANNED })
      .eq("id", options.placeId)
      .eq("trip_id", CHICAGO_TRIP_ID);

    if (statusError) {
      return { ok: false, error: statusError.message };
    }

    return { ok: true };
  }

  const targetDayId = options.assignToDayId;
  if (!targetDayId) {
    return { ok: false, error: "Selecciona un día para la reserva." };
  }

  const { data: day, error: dayError } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("id", targetDayId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (dayError) {
    return { ok: false, error: dayError.message };
  }

  if (!day) {
    return { ok: false, error: "Día no válido." };
  }

  const { data: lastItem, error: lastItemError } = await supabase
    .from("itinerary_items")
    .select("order_index")
    .eq("itinerary_day_id", targetDayId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastItemError) {
    return { ok: false, error: lastItemError.message };
  }

  const nextOrderIndex =
    typeof lastItem?.order_index === "number" ? lastItem.order_index + 1 : 0;

  const { error: insertError } = await supabase.from("itinerary_items").insert({
    itinerary_day_id: targetDayId,
    place_id: options.placeId,
    order_index: nextOrderIndex,
    is_fixed: true,
    start_time: startTime,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: statusError } = await supabase
    .from("places")
    .update({ status: PLACE_STATUS_PLANNED })
    .eq("id", options.placeId)
    .eq("trip_id", CHICAGO_TRIP_ID);

  if (statusError) {
    return { ok: false, error: statusError.message };
  }

  return { ok: true };
}
