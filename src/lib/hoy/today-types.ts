import { TRIP_DAY_COUNT } from "@/lib/constants";
import type { TripTravelSettings } from "@/lib/trips/travel-info";
import { formatCalendarDateLabel, parseDateOnly } from "@/lib/trips/trip-calendar";
import { getTripDateOnlyString } from "@/lib/trips/trip-time";

export const ITINERARY_ITEM_STATUS_PENDING = "pending" as const;
export const ITINERARY_ITEM_STATUS_DONE = "done" as const;
export const ITINERARY_ITEM_STATUS_SKIPPED = "skipped" as const;

export type ItineraryItemStatus =
  | typeof ITINERARY_ITEM_STATUS_PENDING
  | typeof ITINERARY_ITEM_STATUS_DONE
  | typeof ITINERARY_ITEM_STATUS_SKIPPED;

export type TodayPlace = {
  id: string;
  name: string;
  category: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
};

export type TodayBlock = {
  id: string;
  order_index: number;
  start_time: string | null;
  end_time: string | null;
  status: ItineraryItemStatus;
  place: TodayPlace;
};

export type TodayDayData = {
  dayNumber: number;
  dayId: string;
  blocks: TodayBlock[];
};

export type TripTodayPhase =
  | "no_start_date"
  | "before_trip"
  | "during_trip"
  | "after_trip";

export type TodayPageContext = {
  startDate: string | null;
  startDateLabel: string | null;
  tripPhase: TripTodayPhase;
  autoDayNumber: number | null;
  days: { id: string; day_number: number }[];
  tripSettings: TripTravelSettings;
};

export function normalizeItemStatus(value: string | null | undefined): ItineraryItemStatus {
  if (
    value === ITINERARY_ITEM_STATUS_DONE ||
    value === ITINERARY_ITEM_STATUS_SKIPPED
  ) {
    return value;
  }

  return ITINERARY_ITEM_STATUS_PENDING;
}

function formatReferenceDateOnly(
  referenceDate: Date,
  timezone?: string | null,
): string {
  return getTripDateOnlyString(referenceDate, timezone) ?? formatDateOnly(referenceDate);
}

export function getTripDayFromStartDate(
  startDate: string,
  referenceDate: Date = new Date(),
  timezone?: string | null,
): number | null {
  const start = parseDateOnly(startDate);
  const today = parseDateOnly(formatReferenceDateOnly(referenceDate, timezone));

  if (!start || !today) {
    return null;
  }

  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;

  if (diffDays < 1 || diffDays > TRIP_DAY_COUNT) {
    return null;
  }

  return diffDays;
}

export function resolveTripTodayPhase(
  startDate: string | null | undefined,
  referenceDate: Date = new Date(),
  timezone?: string | null,
): TripTodayPhase {
  if (!startDate?.trim()) {
    return "no_start_date";
  }

  const start = parseDateOnly(startDate);
  const today = parseDateOnly(formatReferenceDateOnly(referenceDate, timezone));

  if (!start || !today) {
    return "no_start_date";
  }

  if (today.getTime() < start.getTime()) {
    return "before_trip";
  }

  if (getTripDayFromStartDate(startDate, referenceDate, timezone) != null) {
    return "during_trip";
  }

  return "after_trip";
}

function formatDateOnly(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getPendingBlocks(blocks: TodayBlock[]): TodayBlock[] {
  return sortTodayBlocks(
    blocks.filter((block) => block.status === ITINERARY_ITEM_STATUS_PENDING),
  );
}

export function sortTodayBlocks(blocks: TodayBlock[]): TodayBlock[] {
  return [...blocks].sort((a, b) => {
    const aMinutes = parseTimeSortKey(a.start_time);
    const bMinutes = parseTimeSortKey(b.start_time);

    if (aMinutes !== bMinutes) {
      return aMinutes - bMinutes;
    }

    return a.order_index - b.order_index;
  });
}

function parseTimeSortKey(value: string | null): number {
  if (!value) {
    return 24 * 60 + 1;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return 24 * 60 + 1;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}
