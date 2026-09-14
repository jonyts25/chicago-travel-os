import type { PlaceInterest } from "@/lib/places/place-detail";
import type { OptimizerPlace } from "@/lib/itinerary/optimizer/types";

export type MealSlot = "morning" | "midday" | "afternoon" | "evening";

export const MAX_MEALS_PER_DAY = 3;

const FOOD_CATEGORY_MARKERS = ["restaurante", "comida", "café", "cafe"];

export function normalizePlaceInterest(value: string | null | undefined): PlaceInterest {
  if (value === "jonathan" || value === "mercedes" || value === "both") {
    return value;
  }

  return "both";
}

export function isFoodCategory(category: string | null | undefined): boolean {
  if (!category?.trim()) {
    return false;
  }

  const normalized = category.trim().toLowerCase();
  return FOOD_CATEGORY_MARKERS.some((marker) => normalized.includes(marker));
}

export function getMealSlot(minutesFromMidnight: number): MealSlot {
  if (minutesFromMidnight < 11 * 60) {
    return "morning";
  }

  if (minutesFromMidnight < 14 * 60) {
    return "midday";
  }

  if (minutesFromMidnight < 17 * 60) {
    return "afternoon";
  }

  return "evening";
}

export type DayMealState = {
  mealCount: number;
  mealSlotsUsed: Set<MealSlot>;
};

export function createDayMealState(): DayMealState {
  return {
    mealCount: 0,
    mealSlotsUsed: new Set(),
  };
}

export function registerMealAtSlot(state: DayMealState, slot: MealSlot): void {
  state.mealCount += 1;
  state.mealSlotsUsed.add(slot);
}

export function canAddFoodPlace(
  state: DayMealState,
  estimatedStartMinutes: number,
): boolean {
  if (state.mealCount >= MAX_MEALS_PER_DAY) {
    return false;
  }

  const slot = getMealSlot(estimatedStartMinutes);
  return !state.mealSlotsUsed.has(slot);
}

export type InterestCounts = Record<PlaceInterest, number>;

export function createInterestCounts(): InterestCounts {
  return { jonathan: 0, mercedes: 0, both: 0 };
}

export function registerInterest(counts: InterestCounts, interest: PlaceInterest): void {
  counts[interest] += 1;
}

export function comparePlacesForSelection(
  a: OptimizerPlace,
  b: OptimizerPlace,
  interestCounts: InterestCounts,
): number {
  if (a.priorityRank !== b.priorityRank) {
    return a.priorityRank - b.priorityRank;
  }

  const interestDelta =
    interestCounts[a.interest] - interestCounts[b.interest];
  if (interestDelta !== 0) {
    return interestDelta;
  }

  return a.durationMinutes - b.durationMinutes;
}
