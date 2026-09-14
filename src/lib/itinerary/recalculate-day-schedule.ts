import {
  calculateDaySchedule,
  defaultDurationMinutes,
  minutesToTimeValue,
  parseTimeToMinutes,
  type DayScheduleItemInput,
} from "@/lib/itinerary/schedule-day";
import { haversineTravelMinutes } from "@/lib/itinerary/optimizer/geo";
import { hasCoordinates } from "@/lib/places/schema";
import { loadDayEndWarningMinutes, loadDayStartMinutes } from "@/lib/itinerary/load-day-constraints";
import { createClient } from "@/lib/supabase/server";

type ScheduleItemRow = {
  id: string;
  order_index: number;
  is_fixed: boolean | null;
  start_time: string | null;
  places:
    | { duration_minutes: number | null; lat: number | null; lng: number | null }
    | { duration_minutes: number | null; lat: number | null; lng: number | null }[]
    | null;
};

function normalizePlaceJoin(
  value: ScheduleItemRow["places"],
): { duration_minutes: number | null; lat: number | null; lng: number | null } | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function computeTravelMinutesToNext(
  currentPlace: ReturnType<typeof normalizePlaceJoin>,
  nextPlace: ReturnType<typeof normalizePlaceJoin>,
): number | null {
  if (
    !currentPlace ||
    !nextPlace ||
    !hasCoordinates(currentPlace) ||
    !hasCoordinates(nextPlace)
  ) {
    return null;
  }

  return haversineTravelMinutes(currentPlace, nextPlace);
}

export async function recalculateDaySchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  itineraryDayId: string,
): Promise<{ ok: boolean; error?: string; warnings: string[] }> {
  const { data: rows, error: fetchError } = await supabase
    .from("itinerary_items")
    .select(
      "id, order_index, is_fixed, start_time, places ( duration_minutes, lat, lng )",
    )
    .eq("itinerary_day_id", itineraryDayId)
    .order("order_index", { ascending: true });

  if (fetchError) {
    return { ok: false, error: fetchError.message, warnings: [] };
  }

  const itemRows = (rows ?? []) as ScheduleItemRow[];
  const placeByRow = itemRows.map((row) => normalizePlaceJoin(row.places));

  const items = itemRows.map((row, index): DayScheduleItemInput => {
    const place = placeByRow[index];

    return {
      id: row.id,
      orderIndex: row.order_index,
      durationMinutes: defaultDurationMinutes(place?.duration_minutes),
      isFixed: Boolean(row.is_fixed),
      fixedStartTime: row.is_fixed ? row.start_time : null,
      travelMinutesToNext:
        index < itemRows.length - 1
          ? computeTravelMinutesToNext(place, placeByRow[index + 1])
          : null,
    };
  });

  const { schedules, warnings } = calculateDaySchedule(items, {
    dayStartMinutes: await loadDayStartMinutes(supabase, tripId, itineraryDayId),
    dayEndWarningMinutes: await loadDayEndWarningMinutes(supabase, tripId, itineraryDayId),
  });
  const durationById = new Map(items.map((item) => [item.id, item.durationMinutes]));

  for (let index = 0; index < itemRows.length; index += 1) {
    const row = itemRows[index];
    const schedule = schedules.find((entry) => entry.id === row.id);
    if (!schedule) {
      continue;
    }

    const isFixed = Boolean(row?.is_fixed && row.start_time);
    const durationMinutes = durationById.get(schedule.id) ?? defaultDurationMinutes(null);

    const startTime = isFixed
      ? row!.start_time!
      : minutesToTimeValue(schedule.startMinutes);

    const endMinutes = isFixed
      ? (parseTimeToMinutes(row!.start_time!) ?? schedule.startMinutes) + durationMinutes
      : schedule.endMinutes;

    const travelTimeToNext =
      index < items.length ? (items[index].travelMinutesToNext ?? null) : null;

    const { error } = await supabase
      .from("itinerary_items")
      .update({
        start_time: startTime,
        end_time: minutesToTimeValue(endMinutes),
        travel_time_to_next_minutes: travelTimeToNext,
      })
      .eq("id", schedule.id);

    if (error) {
      return { ok: false, error: error.message, warnings };
    }
  }

  return { ok: true, warnings };
}

export async function recalculateDayScheduleById(
  tripId: string,
  itineraryDayId: string,
): Promise<{ ok: boolean; error?: string; warnings: string[] }> {
  const supabase = await createClient();
  return recalculateDaySchedule(supabase, tripId, itineraryDayId);
}

export async function recalculateDayScheduleForPlace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  placeId: string,
): Promise<{ ok: boolean; error?: string; warnings: string[] }> {
  const { data: item, error } = await supabase
    .from("itinerary_items")
    .select("itinerary_day_id")
    .eq("place_id", placeId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, warnings: [] };
  }

  if (!item?.itinerary_day_id) {
    return { ok: true, warnings: [] };
  }

  return recalculateDaySchedule(supabase, tripId, item.itinerary_day_id);
}
