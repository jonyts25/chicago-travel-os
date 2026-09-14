import {
  comparePlacesForSelection,
  canAddFoodPlace,
  createDayMealState,
  createInterestCounts,
  getMealSlot,
  isFoodCategory,
  registerInterest,
  registerMealAtSlot,
  type DayMealState,
  type InterestCounts,
} from "@/lib/itinerary/optimizer/constraints";
import {
  averageLatLng,
  estimateRouteMinutesFromPlaces,
  haversineKm,
  haversineTravelMinutes,
  kMeansClusterAssignments,
  nearestNeighborOrder,
} from "@/lib/itinerary/optimizer/geo";
import type {
  OptimizerDayContext,
  OptimizerInput,
  OptimizerPlace,
  OptimizerPlan,
} from "@/lib/itinerary/optimizer/types";

type MutableDayState = OptimizerDayContext & {
  assignedPlaces: OptimizerPlace[];
  mealState: DayMealState;
  interestCounts: InterestCounts;
  globallyAssignedPlaceIds: Set<string>;
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
  const globallyAssignedPlaceIds = new Set(input.usedPlaceIds);

  const dayStates: MutableDayState[] = input.days
    .filter((day) => targetDayIds.includes(day.dayId))
    .map((day) => initializeDayState(day, globallyAssignedPlaceIds));

  const unassignedDueToTime: string[] = [];
  const pool = filterAndSortPool(input.pool, input.usedPlaceIds);

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

  let remainingPool = pool;

  if (dayStates.length > 1) {
    remainingPool = assignFocusCategoryPlaces(dayStates, remainingPool, unassignedDueToTime);
  } else if (dayStates[0]?.focusCategory) {
    remainingPool = assignFocusCategoryPlaces(dayStates, remainingPool, unassignedDueToTime);
  }

  if (remainingPool.length === 0) {
    return {
      dayPlans: dayStates.map((day) => ({
        dayId: day.dayId,
        dayNumber: day.dayNumber,
        orderedPlaceIds: orderPlacesForDay(day).map((place) => place.id),
      })),
      unassignedDueToTime,
    };
  }

  if (dayStates.length === 1) {
    assignPlacesToSingleDay(dayStates[0], remainingPool, unassignedDueToTime);
  } else {
    assignPlacesAcrossDays(dayStates, remainingPool, unassignedDueToTime);
  }

  const dayPlans = dayStates.map((day) => ({
    dayId: day.dayId,
    dayNumber: day.dayNumber,
    orderedPlaceIds: orderPlacesForDay(day).map((place) => place.id),
  }));

  return { dayPlans, unassignedDueToTime };
}

function initializeDayState(
  day: OptimizerDayContext,
  globallyAssignedPlaceIds: Set<string>,
): MutableDayState {
  const mealState = createDayMealState();
  const interestCounts = createInterestCounts();

  for (const place of day.lockedPlaces) {
    globallyAssignedPlaceIds.add(place.id);
    registerInterest(interestCounts, place.interest);

    if (isFoodCategory(place.category)) {
      registerMealAtSlot(mealState, getMealSlot(day.dayStartMinutes));
    }
  }

  return {
    ...day,
    assignedPlaces: [],
    mealState,
    interestCounts,
    globallyAssignedPlaceIds,
  };
}

function filterAndSortPool(
  pool: OptimizerPlace[],
  usedPlaceIds: ReadonlySet<string>,
): OptimizerPlace[] {
  const interestCounts = createInterestCounts();

  return pool
    .filter((place) => !usedPlaceIds.has(place.id))
    .sort((a, b) => comparePlacesForSelection(a, b, interestCounts));
}

function assignFocusCategoryPlaces(
  dayStates: MutableDayState[],
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): OptimizerPlace[] {
  const remainingIds = new Set(pool.map((place) => place.id));

  for (const day of dayStates) {
    if (!day.focusCategory) {
      continue;
    }

    const matchingPlaces = pool
      .filter(
        (place) =>
          remainingIds.has(place.id) &&
          !day.globallyAssignedPlaceIds.has(place.id) &&
          place.category === day.focusCategory,
      )
      .sort((a, b) => comparePlacesForSelection(a, b, day.interestCounts));

    for (const place of matchingPlaces) {
      if (!remainingIds.has(place.id) || day.globallyAssignedPlaceIds.has(place.id)) {
        continue;
      }

      if (tryAddPlaceToDay(day, place)) {
        remainingIds.delete(place.id);
      } else if (place.priorityRank <= 2) {
        unassignedDueToTime.push(place.id);
        remainingIds.delete(place.id);
      }
    }
  }

  return pool.filter((place) => remainingIds.has(place.id));
}

function assignPlacesAcrossDays(
  dayStates: MutableDayState[],
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): void {
  const availablePool = pool.filter((place) =>
    dayStates.every((day) => !day.globallyAssignedPlaceIds.has(place.id)),
  );

  const clusterAssignments = kMeansClusterAssignments(availablePool, dayStates.length);
  const clusters = new Map<number, OptimizerPlace[]>();

  availablePool.forEach((place, index) => {
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
      totalMinutes: estimateRouteMinutesFromPlaces(places),
    }))
    .sort((a, b) => {
      if (a.bestPriority !== b.bestPriority) {
        return a.bestPriority - b.bestPriority;
      }
      return b.totalMinutes - a.totalMinutes;
    });

  const remaining = new Set(availablePool.map((place) => place.id));

  for (const cluster of clusterEntries) {
    const targetDay = pickDayForCluster(dayStates, cluster.centroid, cluster.totalMinutes);

    if (
      targetDay &&
      cluster.places.every(
        (place) =>
          !targetDay.globallyAssignedPlaceIds.has(place.id) &&
          canAddPlace(targetDay, place),
      )
    ) {
      for (const place of cluster.places) {
        addPlaceToDay(targetDay, place);
        remaining.delete(place.id);
      }
      continue;
    }

    const sortedPlaces = [...cluster.places].sort((a, b) => {
      const day = pickDayForPlace(dayStates, a) ?? pickDayForPlace(dayStates, b);
      const interestCounts = day?.interestCounts ?? createInterestCounts();
      return comparePlacesForSelection(a, b, interestCounts);
    });

    for (const place of sortedPlaces) {
      if (!remaining.has(place.id)) {
        continue;
      }

      const day = pickDayForPlace(dayStates, place);
      if (day && tryAddPlaceToDay(day, place)) {
        remaining.delete(place.id);
      } else if (place.priorityRank <= 2) {
        unassignedDueToTime.push(place.id);
        remaining.delete(place.id);
      }
    }
  }

  for (const placeId of remaining) {
    const place = availablePool.find((candidate) => candidate.id === placeId);
    if (!place) {
      continue;
    }

    if (place.priorityRank >= 3) {
      const day = pickDayForPlace(dayStates, place);
      if (day && tryAddPlaceToDay(day, place)) {
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
  const sortedPool = [...pool]
    .filter((place) => !dayState.globallyAssignedPlaceIds.has(place.id))
    .sort((a, b) => {
      const aMatchesFocus =
        dayState.focusCategory && a.category === dayState.focusCategory ? 0 : 1;
      const bMatchesFocus =
        dayState.focusCategory && b.category === dayState.focusCategory ? 0 : 1;

      if (aMatchesFocus !== bMatchesFocus) {
        return aMatchesFocus - bMatchesFocus;
      }

      return comparePlacesForSelection(a, b, dayState.interestCounts);
    });

  for (const place of sortedPool) {
    if (tryAddPlaceToDay(dayState, place)) {
      continue;
    }

    unassignedDueToTime.push(place.id);
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

        const interestA = a.interestCounts[place.interest];
        const interestB = b.interestCounts[place.interest];
        if (interestA !== interestB) {
          return interestA - interestB;
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

function tryAddPlaceToDay(day: MutableDayState, place: OptimizerPlace): boolean {
  if (day.globallyAssignedPlaceIds.has(place.id)) {
    return false;
  }

  if (!canAddPlace(day, place)) {
    return false;
  }

  addPlaceToDay(day, place);
  return true;
}

function addPlaceToDay(day: MutableDayState, place: OptimizerPlace): void {
  day.assignedPlaces.push(place);
  day.globallyAssignedPlaceIds.add(place.id);
  registerInterest(day.interestCounts, place.interest);

  if (isFoodCategory(place.category)) {
    registerMealAtSlot(
      day.mealState,
      getMealSlot(estimateNextPlaceStartMinutes(day, place)),
    );
  }

  const allPlaces = [...day.lockedPlaces, ...day.assignedPlaces];
  day.usedMinutes = estimateRouteMinutesFromPlaces(allPlaces);
  day.centroid = averageLatLng(allPlaces);
}

function canAddPlace(day: MutableDayState, place: OptimizerPlace): boolean {
  if (day.globallyAssignedPlaceIds.has(place.id)) {
    return false;
  }

  const nextPlaces = [...day.lockedPlaces, ...day.assignedPlaces, place];
  if (estimateRouteMinutesFromPlaces(nextPlaces) > day.dayActiveMinutesLimit) {
    return false;
  }

  if (isFoodCategory(place.category)) {
    const estimatedStart = estimateNextPlaceStartMinutes(day, place);
    if (!canAddFoodPlace(day.mealState, estimatedStart)) {
      return false;
    }
  }

  return true;
}

function estimateNextPlaceStartMinutes(
  day: MutableDayState,
  place: OptimizerPlace,
): number {
  const routeSoFar = [...day.lockedPlaces, ...day.assignedPlaces];
  if (routeSoFar.length === 0) {
    return day.dayStartMinutes;
  }

  const travelMinutes = haversineTravelMinutes(
    routeSoFar[routeSoFar.length - 1],
    place,
  );

  return day.dayStartMinutes + day.usedMinutes + travelMinutes;
}

function remainingMinutes(day: MutableDayState): number {
  return day.dayActiveMinutesLimit - day.usedMinutes;
}

/** @deprecated Use estimateRouteMinutesFromPlaces when coordinates are available. */
export function estimateRouteMinutesFromDurations(durations: number[]): number {
  if (durations.length === 0) {
    return 0;
  }

  const visitMinutes = durations.reduce((sum, duration) => sum + duration, 0);
  const travelMinutes = Math.max(0, durations.length - 1) * 20;
  return visitMinutes + travelMinutes;
}
