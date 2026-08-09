import {
  CHICAGO_TRIP_ID,
  PLACE_STATUS_PLANNED,
  PLACE_STATUS_UNPLANNED,
} from "@/lib/constants";
import { ensureItineraryDays } from "@/lib/itinerary/ensure-days";
import {
  resolveDayConstraints,
  type ItineraryDayConstraintsInput,
  type TripDayConstraintsInput,
} from "@/lib/itinerary/day-constraints";
import {
  buildFullTripPlan,
  buildSingleDayPlan,
  estimateRouteMinutesFromDurations,
} from "@/lib/itinerary/optimizer/plan";
import { recalculateDaySchedule } from "@/lib/itinerary/recalculate-day-schedule";
import { averageLatLng } from "@/lib/itinerary/optimizer/geo";
import {
  DEFAULT_VISIT_MINUTES,
  normalizePriorityRank,
  type OptimizerDayContext,
  type OptimizerPlace,
  type OptimizerSummary,
} from "@/lib/itinerary/optimizer/types";
import { hasCoordinates } from "@/lib/places/schema";
import { TRIP_TRAVEL_SELECT } from "@/lib/trips/travel-info";
import { createClient } from "@/lib/supabase/server";

type PlaceRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  duration_minutes: number | null;
  priority: string | null;
  status: string;
  category: string | null;
};

type ItemRow = {
  id: string;
  itinerary_day_id: string;
  place_id: string;
  order_index: number;
  is_fixed: boolean | null;
  places: PlaceRow | PlaceRow[] | null;
};

function toOptimizerPlace(row: PlaceRow): OptimizerPlace | null {
  if (!hasCoordinates(row)) {
    return null;
  }

  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    durationMinutes: row.duration_minutes ?? DEFAULT_VISIT_MINUTES,
    priorityRank: normalizePriorityRank(row.priority),
    category: row.category,
  };
}

function normalizePlaceJoin(value: PlaceRow | PlaceRow[] | null): PlaceRow | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function runFullItineraryOptimizer(): Promise<OptimizerSummary> {
  const context = await loadOptimizerContext();
  if (!context.ok) {
    return context.summary;
  }

  const plan = buildFullTripPlan({
    days: context.dayContexts,
    pool: context.pool,
  });

  return applyOptimizerPlan(plan, context, "append");
}

export async function runSingleDayItineraryOptimizer(
  itineraryDayId: string,
): Promise<OptimizerSummary> {
  const context = await loadOptimizerContext();
  if (!context.ok) {
    return context.summary;
  }

  const targetDay = context.dayContexts.find((day) => day.dayId === itineraryDayId);
  if (!targetDay) {
    return {
      ok: false,
      error: "Día no encontrado.",
      assignedByDay: [],
      unassignedDueToTime: 0,
      withoutCoordinates: context.withoutCoordinates,
      warnings: [],
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Debes iniciar sesión.",
      assignedByDay: [],
      unassignedDueToTime: 0,
      withoutCoordinates: context.withoutCoordinates,
      warnings: [],
    };
  }

  const { data: dayItems, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, place_id, is_fixed")
    .eq("itinerary_day_id", itineraryDayId);

  if (itemsError) {
    return {
      ok: false,
      error: itemsError.message,
      assignedByDay: [],
      unassignedDueToTime: 0,
      withoutCoordinates: context.withoutCoordinates,
      warnings: [],
    };
  }

  const removableItems = (dayItems ?? []).filter((item) => !item.is_fixed);
  const removablePlaceIds = removableItems.map((item) => item.place_id);

  if (removableItems.length > 0) {
    const removableItemIds = removableItems.map((item) => item.id);

    const { error: deleteError } = await supabase
      .from("itinerary_items")
      .delete()
      .in("id", removableItemIds);

    if (deleteError) {
      return {
        ok: false,
        error: deleteError.message,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: context.withoutCoordinates,
        warnings: [],
      };
    }

    const { error: unplanError } = await supabase
      .from("places")
      .update({ status: PLACE_STATUS_UNPLANNED })
      .in("id", removablePlaceIds)
      .eq("trip_id", CHICAGO_TRIP_ID);

    if (unplanError) {
      return {
        ok: false,
        error: unplanError.message,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: context.withoutCoordinates,
        warnings: [],
      };
    }
  }

  const refreshed = await loadOptimizerContext();
  if (!refreshed.ok) {
    return refreshed.summary;
  }

  const refreshedDay = refreshed.dayContexts.find((day) => day.dayId === itineraryDayId);
  if (!refreshedDay) {
    return {
      ok: false,
      error: "No se pudo recargar el día.",
      assignedByDay: [],
      unassignedDueToTime: 0,
      withoutCoordinates: refreshed.withoutCoordinates,
      warnings: [],
    };
  }

  const plan = buildSingleDayPlan(
    {
      days: [refreshedDay],
      pool: refreshed.pool,
    },
    itineraryDayId,
  );

  return applyOptimizerPlan(plan, refreshed, "replace-day", itineraryDayId);
}

type LoadedOptimizerContext = {
  ok: true;
  dayContexts: OptimizerDayContext[];
  pool: OptimizerPlace[];
  withoutCoordinates: number;
  maxOrderByDay: Map<string, number>;
  fixedCountByDay: Map<string, number>;
};

async function loadOptimizerContext(): Promise<
  | LoadedOptimizerContext
  | { ok: false; summary: OptimizerSummary }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      summary: {
        ok: false,
        error: "Debes iniciar sesión.",
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: 0,
        warnings: [],
      },
    };
  }

  const { days, error: ensureError } = await ensureItineraryDays(CHICAGO_TRIP_ID);
  if (ensureError) {
    return {
      ok: false,
      summary: {
        ok: false,
        error: ensureError,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: 0,
        warnings: [],
      },
    };
  }

  const dayIds = days.map((day) => day.id);

  const [placesResult, itemsResult, tripResult] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, lat, lng, duration_minutes, priority, status, category")
      .eq("trip_id", CHICAGO_TRIP_ID),
    dayIds.length > 0
      ? supabase
          .from("itinerary_items")
          .select(
            "id, itinerary_day_id, place_id, order_index, is_fixed, places ( id, name, lat, lng, duration_minutes, priority, status, category )",
          )
          .in("itinerary_day_id", dayIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("trips").select(TRIP_TRAVEL_SELECT).eq("id", CHICAGO_TRIP_ID).maybeSingle(),
  ]);

  if (placesResult.error) {
    return {
      ok: false,
      summary: {
        ok: false,
        error: placesResult.error.message,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: 0,
        warnings: [],
      },
    };
  }

  if (itemsResult.error) {
    return {
      ok: false,
      summary: {
        ok: false,
        error: itemsResult.error.message,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: 0,
        warnings: [],
      },
    };
  }

  if (tripResult.error) {
    return {
      ok: false,
      summary: {
        ok: false,
        error: tripResult.error.message,
        assignedByDay: [],
        unassignedDueToTime: 0,
        withoutCoordinates: 0,
        warnings: [],
      },
    };
  }

  const tripConstraints: TripDayConstraintsInput = {
    timezone: tripResult.data?.timezone ?? null,
    flightArrival: tripResult.data?.flight_arrival ?? null,
    flightDeparture: tripResult.data?.flight_departure ?? null,
    airportTransferMinutes: tripResult.data?.airport_transfer_minutes ?? 90,
  };

  const dayConstraintInputs: ItineraryDayConstraintsInput[] = days.map((day) => ({
    id: day.id,
    dayNumber: day.day_number,
    date: day.date,
    focus: day.focus,
    dayEndOverride: day.day_end_override,
  }));

  const allPlaces = (placesResult.data ?? []) as PlaceRow[];
  const unplannedPlaces = allPlaces.filter((place) => place.status === PLACE_STATUS_UNPLANNED);
  const withoutCoordinates = unplannedPlaces.filter((place) => !hasCoordinates(place)).length;

  const pool = unplannedPlaces
    .map(toOptimizerPlace)
    .filter((place): place is OptimizerPlace => place !== null);

  const itemsByDay = new Map<string, ItemRow[]>();
  for (const row of (itemsResult.data ?? []) as ItemRow[]) {
    const dayItems = itemsByDay.get(row.itinerary_day_id) ?? [];
    dayItems.push(row);
    itemsByDay.set(row.itinerary_day_id, dayItems);
  }

  const maxOrderByDay = new Map<string, number>();
  const fixedCountByDay = new Map<string, number>();

  const dayContexts: OptimizerDayContext[] = days.map((day) => {
    const dayItems = (itemsByDay.get(day.id) ?? []).sort(
      (a, b) => a.order_index - b.order_index,
    );

    const lockedPlaces: OptimizerPlace[] = [];
    for (const item of dayItems) {
      if (!item.is_fixed) {
        continue;
      }

      const place = normalizePlaceJoin(item.places);
      const optimizable = place ? toOptimizerPlace(place) : null;
      if (optimizable) {
        lockedPlaces.push(optimizable);
      }
    }

    fixedCountByDay.set(day.id, lockedPlaces.length);
    maxOrderByDay.set(
      day.id,
      dayItems.reduce((max, item) => Math.max(max, item.order_index), -1),
    );

    const usedMinutes = estimateRouteMinutesFromDurations(
      lockedPlaces.map((place) => place.durationMinutes),
    );

    const resolved = resolveDayConstraints(
      {
        id: day.id,
        dayNumber: day.day_number,
        date: day.date,
        focus: day.focus,
        dayEndOverride: day.day_end_override,
      },
      tripConstraints,
      dayConstraintInputs,
    );

    return {
      dayId: day.id,
      dayNumber: day.day_number,
      lockedPlaceIds: lockedPlaces.map((place) => place.id),
      lockedPlaces,
      usedMinutes,
      centroid: averageLatLng(lockedPlaces),
      dayActiveMinutesLimit: resolved.dayActiveMinutesLimit,
      focusCategory: resolved.focusCategory,
      focusLabel: resolved.focusLabel,
    };
  });

  return {
    ok: true,
    dayContexts,
    pool,
    withoutCoordinates,
    maxOrderByDay,
    fixedCountByDay,
  };
}

async function applyOptimizerPlan(
  plan: ReturnType<typeof buildFullTripPlan>,
  context: LoadedOptimizerContext,
  mode: "append" | "replace-day",
  targetDayId?: string,
): Promise<OptimizerSummary> {
  const supabase = await createClient();
  const warnings: string[] = [];
  const assignedByDay: { dayNumber: number; count: number }[] = [];
  const placeIdsToPlan: string[] = [];

  for (const dayPlan of plan.dayPlans) {
    if (dayPlan.orderedPlaceIds.length === 0) {
      assignedByDay.push({ dayNumber: dayPlan.dayNumber, count: 0 });
      continue;
    }

    if (mode === "replace-day" && dayPlan.dayId !== targetDayId) {
      continue;
    }

    const startOrder = (context.maxOrderByDay.get(dayPlan.dayId) ?? -1) + 1;
    const rows = dayPlan.orderedPlaceIds.map((placeId, index) => ({
      itinerary_day_id: dayPlan.dayId,
      place_id: placeId,
      order_index: startOrder + index,
      is_fixed: false,
    }));

    const { error: insertError } = await supabase.from("itinerary_items").insert(rows);
    if (insertError) {
      return {
        ok: false,
        error: insertError.message,
        assignedByDay,
        unassignedDueToTime: plan.unassignedDueToTime.length,
        withoutCoordinates: context.withoutCoordinates,
        warnings,
      };
    }

    assignedByDay.push({
      dayNumber: dayPlan.dayNumber,
      count: dayPlan.orderedPlaceIds.length,
    });
    placeIdsToPlan.push(...dayPlan.orderedPlaceIds);
  }

  if (placeIdsToPlan.length > 0) {
    const { error: updateError } = await supabase
      .from("places")
      .update({ status: PLACE_STATUS_PLANNED })
      .in("id", placeIdsToPlan)
      .eq("trip_id", CHICAGO_TRIP_ID);

    if (updateError) {
      return {
        ok: false,
        error: updateError.message,
        assignedByDay,
        unassignedDueToTime: plan.unassignedDueToTime.length,
        withoutCoordinates: context.withoutCoordinates,
        warnings,
      };
    }
  }

  if (plan.unassignedDueToTime.length > 0) {
    warnings.push(
      `${plan.unassignedDueToTime.length} lugar(es) sin asignar por falta de tiempo en los días.`,
    );
  }

  if (context.withoutCoordinates > 0) {
    warnings.push(
      `${context.withoutCoordinates} lugar(es) sin coordenadas quedaron fuera del optimizador.`,
    );
  }

  const scheduleWarnings = await recalculateSchedulesForTrip(supabase, {
    onlyDayId: mode === "replace-day" ? targetDayId : undefined,
  });
  warnings.push(...scheduleWarnings);

  return {
    ok: true,
    assignedByDay,
    unassignedDueToTime: plan.unassignedDueToTime.length,
    withoutCoordinates: context.withoutCoordinates,
    warnings,
  };
}

async function recalculateSchedulesForTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: { onlyDayId?: string },
): Promise<string[]> {
  const query = supabase
    .from("itinerary_days")
    .select("id, day_number")
    .eq("trip_id", CHICAGO_TRIP_ID)
    .order("day_number", { ascending: true });

  const { data: days, error } = await query;

  if (error) {
    return [`No se pudieron recalcular horarios: ${error.message}`];
  }

  const warnings: string[] = [];

  for (const day of days ?? []) {
    if (options.onlyDayId && day.id !== options.onlyDayId) {
      continue;
    }

    const { data: items, error: itemsError } = await supabase
      .from("itinerary_items")
      .select("id")
      .eq("itinerary_day_id", day.id)
      .limit(1);

    if (itemsError) {
      warnings.push(`Día ${day.day_number}: ${itemsError.message}`);
      continue;
    }

    if (!items?.length) {
      continue;
    }

    const result = await recalculateDaySchedule(supabase, day.id);
    if (!result.ok) {
      warnings.push(`Día ${day.day_number}: ${result.error ?? "error al calcular horarios"}`);
      continue;
    }

    for (const warning of result.warnings) {
      warnings.push(`Día ${day.day_number}: ${warning}`);
    }
  }

  return warnings;
}
