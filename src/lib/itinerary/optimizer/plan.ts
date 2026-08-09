import {
  DEFAULT_DAY_ACTIVE_MINUTES,
  TRAVEL_MINUTES_BETWEEN_STOPS,
  type OptimizerDayContext,
  type OptimizerInput,
  type OptimizerPlace,
  type OptimizerPlan,
} from "@/lib/itinerary/optimizer/types";
import {
  averageLatLng,
  haversineKm,
  kMeansClusterAssignments,
  nearestNeighborOrder,
} from "@/lib/itinerary/optimizer/geo";

type MutableDayState = OptimizerDayContext & {
  assignedPlaces: OptimizerPlace[];
};

export function buildFullTripPlan(input: OptimizerInput): OptimizerPlan {
  return buildPlanForDays(input, input.days.map((day) => day.dayId));
}

export function buildSingleDayPlan(
  input: OptimizerInput,
  targetDayId: string,
): OptimizerPlan {
  return buildPlanForDays(input, [targetDayId]);
}

function buildPlanForDays(input: OptimizerInput, targetDayIds: string[]): OptimizerPlan {
  const dayStates = input.days
    .filter((day) => targetDayIds.includes(day.dayId))
    .map((day) => ({
      ...day,
      assignedPlaces: [] as OptimizerPlace[],
    }));

  const unassignedDueToTime: string[] = [];
  const pool = [...input.pool].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return a.durationMinutes - b.durationMinutes;
  });

  if (pool.length === 0 || dayStates.length === 0) {
    return {
      dayPlans: dayStates.map((day) => ({
        dayId: day.dayId,
        dayNumber: day.dayNumber,
        orderedPlaceIds: [],
      })),
      unassignedDueToTime,
    };
  }

  if (dayStates.length === 1) {
    assignPlacesToSingleDay(dayStates[0], pool, unassignedDueToTime);
  } else {
    assignPlacesAcrossDays(dayStates, pool, unassignedDueToTime);
  }

  const dayPlans = dayStates.map((day) => ({
    dayId: day.dayId,
    dayNumber: day.dayNumber,
    orderedPlaceIds: orderPlacesForDay(day).map((place) => place.id),
  }));

  return { dayPlans, unassignedDueToTime };
}

function assignPlacesAcrossDays(
  dayStates: MutableDayState[],
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): void {
  const clusterAssignments = kMeansClusterAssignments(pool, dayStates.length);
  const clusters = new Map<number, OptimizerPlace[]>();

  pool.forEach((place, index) => {
    const clusterIndex = clusterAssignments[index];
    const cluster = clusters.get(clusterIndex) ?? [];
    cluster.push(place);
    clusters.set(clusterIndex, cluster);
  });

  const clusterEntries = Array.from(clusters.entries())
    .map(([clusterIndex, places]) => ({
      clusterIndex,
      places,
      centroid: averageLatLng(places),
      bestPriority: Math.min(...places.map((place) => place.priorityRank)),
      totalMinutes: estimateRouteMinutes(places),
    }))
    .sort((a, b) => {
      if (a.bestPriority !== b.bestPriority) {
        return a.bestPriority - b.bestPriority;
      }
      return b.totalMinutes - a.totalMinutes;
    });

  const remaining = new Set(pool.map((place) => place.id));

  for (const cluster of clusterEntries) {
    const targetDay = pickDayForCluster(dayStates, cluster.centroid, cluster.totalMinutes);

    if (targetDay && cluster.places.every((place) => canAddPlace(targetDay, place))) {
      for (const place of cluster.places) {
        addPlaceToDay(targetDay, place);
        remaining.delete(place.id);
      }
      continue;
    }

    const sortedPlaces = [...cluster.places].sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      return a.durationMinutes - b.durationMinutes;
    });

    for (const place of sortedPlaces) {
      if (!remaining.has(place.id)) {
        continue;
      }

      const day = pickDayForPlace(dayStates, place);
      if (day && canAddPlace(day, place)) {
        addPlaceToDay(day, place);
        remaining.delete(place.id);
      } else if (place.priorityRank <= 2) {
        unassignedDueToTime.push(place.id);
        remaining.delete(place.id);
      }
    }
  }

  for (const placeId of remaining) {
    const place = pool.find((candidate) => candidate.id === placeId);
    if (!place) {
      continue;
    }

    if (place.priorityRank >= 3) {
      const day = pickDayForPlace(dayStates, place);
      if (day && canAddPlace(day, place)) {
        addPlaceToDay(day, place);
        continue;
      }
    }

    unassignedDueToTime.push(place.id);
  }
}

function assignPlacesToSingleDay(
  dayState: MutableDayState,
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): void {
  const sortedPool = [...pool].sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    return a.durationMinutes - b.durationMinutes;
  });

  for (const place of sortedPool) {
    if (canAddPlace(dayState, place)) {
      addPlaceToDay(dayState, place);
    } else if (place.priorityRank <= 2) {
      unassignedDueToTime.push(place.id);
    } else {
      unassignedDueToTime.push(place.id);
    }
  }
}

function pickDayForCluster(
  dayStates: MutableDayState[],
  centroid: { lat: number; lng: number } | null,
  totalMinutes: number,
): MutableDayState | null {
  const candidates = dayStates
    .filter((day) => remainingMinutes(day) >= totalMinutes)
    .sort((a, b) => {
      const distanceA = centroid && a.centroid ? haversineKm(centroid, a.centroid) : 9999;
      const distanceB = centroid && b.centroid ? haversineKm(centroid, b.centroid) : 9999;
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return remainingMinutes(b) - remainingMinutes(a);
    });

  return candidates[0] ?? null;
}

function pickDayForPlace(
  dayStates: MutableDayState[],
  place: OptimizerPlace,
): MutableDayState | null {
  return (
    dayStates
      .filter((day) => canAddPlace(day, place))
      .sort((a, b) => {
        const distanceA = a.centroid ? haversineKm(place, a.centroid) : 9999;
        const distanceB = b.centroid ? haversineKm(place, b.centroid) : 9999;
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
        return remainingMinutes(b) - remainingMinutes(a);
      })[0] ?? null
  );
}

function orderPlacesForDay(day: MutableDayState): OptimizerPlace[] {
  if (day.assignedPlaces.length === 0) {
    return [];
  }

  const startFrom =
    day.lockedPlaces.length > 0
      ? day.lockedPlaces[day.lockedPlaces.length - 1]
      : day.centroid;

  return nearestNeighborOrder(day.assignedPlaces, startFrom);
}

function addPlaceToDay(day: MutableDayState, place: OptimizerPlace): void {
  day.assignedPlaces.push(place);
  day.usedMinutes = estimateRouteMinutes([...day.lockedPlaces, ...day.assignedPlaces]);
  day.centroid = averageLatLng([...day.lockedPlaces, ...day.assignedPlaces]);
}

function canAddPlace(day: MutableDayState, place: OptimizerPlace): boolean {
  const nextPlaces = [...day.lockedPlaces, ...day.assignedPlaces, place];
  return estimateRouteMinutes(nextPlaces) <= DEFAULT_DAY_ACTIVE_MINUTES;
}

function remainingMinutes(day: MutableDayState): number {
  return DEFAULT_DAY_ACTIVE_MINUTES - day.usedMinutes;
}

function estimateRouteMinutes(places: OptimizerPlace[]): number {
  if (places.length === 0) {
    return 0;
  }

  const visitMinutes = places.reduce((sum, place) => sum + place.durationMinutes, 0);
  const travelMinutes = Math.max(0, places.length - 1) * TRAVEL_MINUTES_BETWEEN_STOPS;
  return visitMinutes + travelMinutes;
}

export function estimateRouteMinutesFromDurations(durations: number[]): number {
  if (durations.length === 0) {
    return 0;
  }

  const visitMinutes = durations.reduce((sum, duration) => sum + duration, 0);
  const travelMinutes = Math.max(0, durations.length - 1) * TRAVEL_MINUTES_BETWEEN_STOPS;
  return visitMinutes + travelMinutes;
}
