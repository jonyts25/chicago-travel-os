import { CHICAGO_TRIP_ID, TRIP_DAY_COUNT } from "@/lib/constants";

export const ITINERARY_ITEM_STATUS_PENDING = "pending" as const;
export const ITINERARY_ITEM_STATUS_DONE = "done" as const;
export const ITINERARY_ITEM_STATUS_SKIPPED = "skipped" as const;

export type ItineraryItemStatus =
  | typeof ITINERARY_ITEM_STATUS_PENDING
  | typeof ITINERARY_ITEM_STATUS_DONE
  | typeof ITINERARY_ITEM_STATUS_SKIPPED;

export const ACTIVE_DAY_STORAGE_KEY = "chicago-travel-active-day";

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

export type TodayPageContext = {
  startDate: string | null;
  autoDayNumber: number | null;
  days: { id: string; day_number: number }[];
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

export function getTripDayFromStartDate(
  startDate: string,
  referenceDate: Date = new Date(),
): number | null {
  const start = parseDateOnly(startDate);
  const today = parseDateOnly(formatDateOnly(referenceDate));

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

function parseDateOnly(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
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
