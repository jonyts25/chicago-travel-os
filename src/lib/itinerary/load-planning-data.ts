import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { ensureItineraryDays } from "@/lib/itinerary/ensure-days";
import type {
  PlanningBoardData,
  PlanningDay,
  PlanningDayItem,
  PlanningPlace,
} from "@/lib/itinerary/schema";
import { hasCoordinates } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";

type ItemRow = {
  id: string;
  order_index: number;
  itinerary_day_id: string;
  place_id: string;
  is_fixed: boolean | null;
  start_time: string | null;
  end_time: string | null;
  places: PlanningPlace | PlanningPlace[] | null;
};

export async function loadPlanningBoardData(): Promise<{
  data: PlanningBoardData | null;
  error: string | null;
}> {
  const { days: itineraryDays, error: ensureError } =
    await ensureItineraryDays(CHICAGO_TRIP_ID);

  if (ensureError) {
    return { data: null, error: ensureError };
  }

  const supabase = await createClient();
  const dayIds = itineraryDays.map((day) => day.id);

  const [itemsResult, unplannedResult] = await Promise.all([
    dayIds.length > 0
      ? supabase
          .from("itinerary_items")
          .select(
            "id, order_index, itinerary_day_id, place_id, is_fixed, start_time, end_time, places ( id, name, category, duration_minutes )",
          )
          .in("itinerary_day_id", dayIds)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("places")
      .select("id, name, category, duration_minutes, lat, lng")
      .eq("trip_id", CHICAGO_TRIP_ID)
      .eq("status", PLACE_STATUS_UNPLANNED)
      .order("name", { ascending: true }),
  ]);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error.message };
  }

  if (unplannedResult.error) {
    return { data: null, error: unplannedResult.error.message };
  }

  const itemsByDay = new Map<string, PlanningDayItem[]>();

  for (const row of (itemsResult.data ?? []) as ItemRow[]) {
    const place = normalizePlaceJoin(row.places);
    if (!place) {
      continue;
    }

    const item: PlanningDayItem = {
      id: row.id,
      order_index: row.order_index,
      is_fixed: Boolean(row.is_fixed),
      start_time: row.start_time,
      end_time: row.end_time,
      place,
    };

    const dayItems = itemsByDay.get(row.itinerary_day_id) ?? [];
    dayItems.push(item);
    itemsByDay.set(row.itinerary_day_id, dayItems);
  }

  const days: PlanningDay[] = itineraryDays.map((day) => {
    const items = itemsByDay.get(day.id) ?? [];
    items.sort((a, b) => a.order_index - b.order_index);

    return {
      id: day.id,
      day_number: day.day_number,
      date: day.date,
      items,
    };
  });

  const allUnplanned = (unplannedResult.data ?? []) as Array<
    PlanningPlace & { lat: number | null; lng: number | null }
  >;

  const unplannedPlaces: PlanningPlace[] = [];
  const unlocatedPlaces: PlanningPlace[] = [];

  for (const place of allUnplanned) {
    if (hasCoordinates(place)) {
      unplannedPlaces.push({
        id: place.id,
        name: place.name,
        category: place.category,
        duration_minutes: place.duration_minutes,
      });
    } else {
      unlocatedPlaces.push({
        id: place.id,
        name: place.name,
        category: place.category,
        duration_minutes: place.duration_minutes,
      });
    }
  }

  return {
    data: {
      days,
      unplannedPlaces,
      unlocatedPlaces,
    },
    error: null,
  };
}

function normalizePlaceJoin(
  value: PlanningPlace | PlanningPlace[] | null,
): PlanningPlace | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
