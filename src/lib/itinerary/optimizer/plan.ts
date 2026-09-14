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
  type LatLng,
} from "@/lib/itinerary/optimizer/geo";
import type {
  OptimizerDayContext,
  OptimizerInput,
  OptimizerPlace,
  OptimizerPlan,
} from "@/lib/itinerary/optimizer/types";

type MutableDayState = OptimizerDayContext & {
  assignedPlaces: OptimizerPlace[];
  assignedFocusPlaces: OptimizerPlace[];
  assignedFillerPlaces: OptimizerPlace[];
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
  const unassignedFocusDueToTime: string[] = [];
  let remainingPool = filterAndSortPool(input.pool, input.usedPlaceIds);

  if (remainingPool.length === 0 && dayStates.every((day) => day.assignedPlaces.length === 0)) {
    return emptyPlan(dayStates, unassignedDueToTime, unassignedFocusDueToTime);
  }

  const focusedDays = dayStates
    .filter((day) => day.focusCategory)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  for (const day of focusedDays) {
    remainingPool = assignPlacesToFocusedDay(
      day,
      remainingPool,
      unassignedFocusDueToTime,
    );
  }

  const focusOnlyRun =
    dayStates.length === 1 && focusedDays.length === 1 && remainingPool.length === 0;

  if (!focusOnlyRun && remainingPool.length > 0) {
    const openDays = dayStates.filter((day) => remainingMinutes(day) > 0);

    if (openDays.length === 1) {
      assignPlacesToGeneralDay(openDays[0], remainingPool, unassignedDueToTime);
    } else if (openDays.length > 1) {
      assignPlacesAcrossDays(openDays, remainingPool, unassignedDueToTime);
    }
  }

  const dayPlans = dayStates.map((day) => ({
    dayId: day.dayId,
    dayNumber: day.dayNumber,
    orderedPlaceIds: orderPlacesForDay(day).map((place) => place.id),
  }));

  return { dayPlans, unassignedDueToTime, unassignedFocusDueToTime };
}

function emptyPlan(
  dayStates: MutableDayState[],
  unassignedDueToTime: string[],
  unassignedFocusDueToTime: string[],
): OptimizerPlan {
  return {
    dayPlans: dayStates.map((day) => ({
      dayId: day.dayId,
      dayNumber: day.dayNumber,
      orderedPlaceIds: [],
    })),
    unassignedDueToTime,
    unassignedFocusDueToTime,
  };
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
    assignedFocusPlaces: [],
    assignedFillerPlaces: [],
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

function placeMatchesFocusCategory(
  place: OptimizerPlace,
  focusCategory: string,
): boolean {
  return place.category === focusCategory;
}

function assignPlacesToFocusedDay(
  day: MutableDayState,
  pool: OptimizerPlace[],
  unassignedFocusDueToTime: string[],
): OptimizerPlace[] {
  const focusCategory = day.focusCategory;
  if (!focusCategory) {
    return pool;
  }

  const consumedIds = new Set<string>();

  const focusCandidates = pool
    .filter(
      (place) =>
        !day.globallyAssignedPlaceIds.has(place.id) &&
        placeMatchesFocusCategory(place, focusCategory),
    )
    .sort((a, b) => comparePlacesForSelection(a, b, day.interestCounts));

  for (const place of focusCandidates) {
    if (tryAddPlaceToDay(day, place, "focus")) {
      consumedIds.add(place.id);
    } else {
      unassignedFocusDueToTime.push(place.id);
      consumedIds.add(place.id);
    }
  }

  const fillerCandidates = pool
    .filter(
      (place) =>
        !consumedIds.has(place.id) &&
        !day.globallyAssignedPlaceIds.has(place.id) &&
        !placeMatchesFocusCategory(place, focusCategory) &&
        isFoodCategory(place.category),
    )
    .sort((a, b) => compareByProximityToRoute(a, b, day));

  for (const place of fillerCandidates) {
    if (!canAddPlace(day, place)) {
      continue;
    }

    if (tryAddPlaceToDay(day, place, "filler")) {
      consumedIds.add(place.id);
    }
  }

  return pool.filter((place) => !consumedIds.has(place.id));
}

function compareByProximityToRoute(
  a: OptimizerPlace,
  b: OptimizerPlace,
  day: MutableDayState,
): number {
  const anchor = routeAnchor(day);
  if (!anchor) {
    return 0;
  }

  return haversineKm(a, anchor) - haversineKm(b, anchor);
}

function routeAnchor(day: MutableDayState): LatLng | null {
  if (day.assignedFocusPlaces.length > 0) {
    return day.assignedFocusPlaces[day.assignedFocusPlaces.length - 1];
  }

  if (day.lockedPlaces.length > 0) {
    return day.lockedPlaces[day.lockedPlaces.length - 1];
  }

  return day.centroid;
}

function assignPlacesToGeneralDay(
  dayState: MutableDayState,
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): void {
  const sortedPool = [...pool]
    .filter((place) => !dayState.globallyAssignedPlaceIds.has(place.id))
    .sort((a, b) => comparePlacesForSelection(a, b, dayState.interestCounts));

  for (const place of sortedPool) {
    if (tryAddPlaceToDay(dayState, place, "general")) {
      continue;
    }

    unassignedDueToTime.push(place.id);
  }
}

function assignPlacesAcrossDays(
  dayStates: MutableDayState[],
  pool: OptimizerPlace[],
  unassignedDueToTime: string[],
): void {
  const availablePool = pool.filter((place) =>
    dayStates.every((day) => !day.globallyAssignedPlaceIds.has(place.id)),
  );

  if (availablePool.length === 0) {
    return;
  }

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
        addPlaceToDay(targetDay, place, "general");
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
      if (day && tryAddPlaceToDay(day, place, "general")) {
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
      if (day && tryAddPlaceToDay(day, place, "general")) {
        continue;
      }
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
        const aMatchesFocus =
          a.focusCategory && placeMatchesFocusCategory(place, a.focusCategory) ? 0 : 1;
        const bMatchesFocus =
          b.focusCategory && placeMatchesFocusCategory(place, b.focusCategory) ? 0 : 1;

        if (aMatchesFocus !== bMatchesFocus) {
          return aMatchesFocus - bMatchesFocus;
        }

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

  if (day.focusCategory && day.assignedFocusPlaces.length > 0) {
    return orderFocusedDayPlaces(day);
  }

  const startFrom =
    day.lockedPlaces.length > 0
      ? day.lockedPlaces[day.lockedPlaces.length - 1]
      : day.centroid;

  return nearestNeighborOrder(day.assignedPlaces, startFrom);
}

function orderFocusedDayPlaces(day: MutableDayState): OptimizerPlace[] {
  const startFrom =
    day.lockedPlaces.length > 0
      ? day.lockedPlaces[day.lockedPlaces.length - 1]
      : day.centroid;

  const focusRoute = nearestNeighborOrder(day.assignedFocusPlaces, startFrom);

  if (day.assignedFillerPlaces.length === 0) {
    return focusRoute;
  }

  return insertFillerPlacesIntoRoute(focusRoute, day.assignedFillerPlaces);
}

function insertFillerPlacesIntoRoute(
  focusRoute: OptimizerPlace[],
  fillers: OptimizerPlace[],
): OptimizerPlace[] {
  const route = [...focusRoute];

  for (const filler of fillers) {
    if (route.length === 0) {
      route.push(filler);
      continue;
    }

    let bestIndex = route.length;
    let bestExtraTravel = Number.POSITIVE_INFINITY;

    for (let index = 0; index <= route.length; index += 1) {
      const extraTravel = insertionTravelCost(route, filler, index);
      if (extraTravel < bestExtraTravel) {
        bestExtraTravel = extraTravel;
        bestIndex = index;
      }
    }

    route.splice(bestIndex, 0, filler);
  }

  return route;
}

function insertionTravelCost(
  route: OptimizerPlace[],
  filler: OptimizerPlace,
  index: number,
): number {
  const previous = index > 0 ? route[index - 1] : null;
  const next = index < route.length ? route[index] : null;

  if (!previous && !next) {
    return 0;
  }

  if (!previous) {
    return haversineTravelMinutes(filler, next!);
  }

  if (!next) {
    return haversineTravelMinutes(previous, filler);
  }

  const before = haversineTravelMinutes(previous, next);
  const after =
    haversineTravelMinutes(previous, filler) + haversineTravelMinutes(filler, next);

  return after - before;
}

function tryAddPlaceToDay(
  day: MutableDayState,
  place: OptimizerPlace,
  kind: "focus" | "filler" | "general",
): boolean {
  if (day.globallyAssignedPlaceIds.has(place.id)) {
    return false;
  }

  if (!canAddPlace(day, place)) {
    return false;
  }

  addPlaceToDay(day, place, kind);
  return true;
}

function addPlaceToDay(
  day: MutableDayState,
  place: OptimizerPlace,
  kind: "focus" | "filler" | "general",
): void {
  day.assignedPlaces.push(place);

  if (kind === "focus") {
    day.assignedFocusPlaces.push(place);
  } else if (kind === "filler") {
    day.assignedFillerPlaces.push(place);
  }

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
