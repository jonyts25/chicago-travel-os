import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { ensureItineraryDays } from "@/lib/itinerary/ensure-days";
import {
  getTripDayFromStartDate,
  normalizeItemStatus,
  sortTodayBlocks,
  type TodayBlock,
  type TodayDayData,
  type TodayPageContext,
  type TodayPlace,
} from "@/lib/hoy/today-types";
import type { Trip } from "@/lib/trips/schema";
import {
  TRIP_TRAVEL_SELECT,
  normalizeTripTravelSettings,
} from "@/lib/trips/travel-info";
import { createClient } from "@/lib/supabase/server";

type ItemRow = {
  id: string;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  places:
    | {
        id: string;
        name: string;
        category: string | null;
        maps_url: string | null;
        lat: number | null;
        lng: number | null;
      }
    | {
        id: string;
        name: string;
        category: string | null;
        maps_url: string | null;
        lat: number | null;
        lng: number | null;
      }[]
    | null;
};

export async function loadTodayPageContext(): Promise<{
  context: TodayPageContext | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { context: null, error: "Debes iniciar sesión." };
  }

  const [{ data: trip, error: tripError }, { days, error: daysError }] =
    await Promise.all([
      supabase
        .from("trips")
        .select(`id, start_date, ${TRIP_TRAVEL_SELECT}`)
        .eq("id", CHICAGO_TRIP_ID)
        .maybeSingle(),
      ensureItineraryDays(CHICAGO_TRIP_ID),
    ]);

  if (tripError) {
    return { context: null, error: tripError.message };
  }

  if (daysError) {
    return { context: null, error: daysError };
  }

  const startDate = (trip as Trip | null)?.start_date ?? null;
  const autoDayNumber = startDate ? getTripDayFromStartDate(startDate) : null;
  const tripSettings = normalizeTripTravelSettings(trip);

  return {
    context: {
      startDate,
      autoDayNumber,
      days: days.map((day) => ({ id: day.id, day_number: day.day_number })),
      tripSettings,
    },
    error: null,
  };
}

export async function loadTodayDayData(dayNumber: number): Promise<{
  data: TodayDayData | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "Debes iniciar sesión." };
  }

  const { data: day, error: dayError } = await supabase
    .from("itinerary_days")
    .select("id, day_number")
    .eq("trip_id", CHICAGO_TRIP_ID)
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (dayError) {
    return { data: null, error: dayError.message };
  }

  if (!day) {
    return { data: null, error: `No existe el día ${dayNumber}.` };
  }

  const { data: rows, error: itemsError } = await supabase
    .from("itinerary_items")
    .select(
      "id, order_index, start_time, end_time, status, places ( id, name, category, maps_url, lat, lng )",
    )
    .eq("itinerary_day_id", day.id)
    .order("order_index", { ascending: true });

  if (itemsError) {
    return { data: null, error: itemsError.message };
  }

  const blocks: TodayBlock[] = [];

  for (const row of (rows ?? []) as ItemRow[]) {
    const placeJoin = Array.isArray(row.places) ? row.places[0] : row.places;
    if (!placeJoin) {
      continue;
    }

    const place: TodayPlace = {
      id: placeJoin.id,
      name: placeJoin.name,
      category: placeJoin.category,
      maps_url: placeJoin.maps_url,
      lat: placeJoin.lat,
      lng: placeJoin.lng,
    };

    blocks.push({
      id: row.id,
      order_index: row.order_index,
      start_time: row.start_time,
      end_time: row.end_time,
      status: normalizeItemStatus(row.status),
      place,
    });
  }

  return {
    data: {
      dayNumber: day.day_number,
      dayId: day.id,
      blocks: sortTodayBlocks(blocks),
    },
    error: null,
  };
}

export async function resolveDayNumberForItem(
  itemId: string,
): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("itinerary_items")
    .select("itinerary_days!inner(day_number, trip_id)")
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const dayJoin = data.itinerary_days as { day_number: number; trip_id: string } | { day_number: number; trip_id: string }[];
  const day = Array.isArray(dayJoin) ? dayJoin[0] : dayJoin;

  if (!day || day.trip_id !== CHICAGO_TRIP_ID) {
    return null;
  }

  return day.day_number;
}
