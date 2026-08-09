import {
  calculateDaySchedule,
  defaultDurationMinutes,
  minutesToTimeValue,
  parseTimeToMinutes,
  type DayScheduleItemInput,
} from "@/lib/itinerary/schedule-day";
import { loadDayEndWarningMinutes } from "@/lib/itinerary/load-day-constraints";
import { createClient } from "@/lib/supabase/server";

type ScheduleItemRow = {
  id: string;
  order_index: number;
  is_fixed: boolean | null;
  start_time: string | null;
  places: { duration_minutes: number | null } | { duration_minutes: number | null }[] | null;
};

export async function recalculateDaySchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itineraryDayId: string,
): Promise<{ ok: boolean; error?: string; warnings: string[] }> {
  const { data: rows, error: fetchError } = await supabase
    .from("itinerary_items")
    .select("id, order_index, is_fixed, start_time, places ( duration_minutes )")
    .eq("itinerary_day_id", itineraryDayId)
    .order("order_index", { ascending: true });

  if (fetchError) {
    return { ok: false, error: fetchError.message, warnings: [] };
  }

  const itemRows = (rows ?? []) as ScheduleItemRow[];

  const items = itemRows.map((row): DayScheduleItemInput => {
    const place = Array.isArray(row.places) ? row.places[0] : row.places;

    return {
      id: row.id,
      orderIndex: row.order_index,
      durationMinutes: defaultDurationMinutes(place?.duration_minutes),
      isFixed: Boolean(row.is_fixed),
      fixedStartTime: row.is_fixed ? row.start_time : null,
    };
  });

  const { schedules, warnings } = calculateDaySchedule(items, {
    dayEndWarningMinutes: await loadDayEndWarningMinutes(supabase, itineraryDayId),
  });
  const durationById = new Map(items.map((item) => [item.id, item.durationMinutes]));

  for (const schedule of schedules) {
    const row = itemRows.find((item) => item.id === schedule.id);
    const isFixed = Boolean(row?.is_fixed && row.start_time);
    const durationMinutes = durationById.get(schedule.id) ?? defaultDurationMinutes(null);

    const startTime = isFixed
      ? row!.start_time!
      : minutesToTimeValue(schedule.startMinutes);

    const endMinutes = isFixed
      ? (parseTimeToMinutes(row!.start_time!) ?? schedule.startMinutes) + durationMinutes
      : schedule.endMinutes;

    const { error } = await supabase
      .from("itinerary_items")
      .update({
        start_time: startTime,
        end_time: minutesToTimeValue(endMinutes),
      })
      .eq("id", schedule.id);

    if (error) {
      return { ok: false, error: error.message, warnings };
    }
  }

  return { ok: true, warnings };
}

export async function recalculateDayScheduleById(
  itineraryDayId: string,
): Promise<{ ok: boolean; error?: string; warnings: string[] }> {
  const supabase = await createClient();
  return recalculateDaySchedule(supabase, itineraryDayId);
}

export async function recalculateDayScheduleForPlace(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  return recalculateDaySchedule(supabase, item.itinerary_day_id);
}
