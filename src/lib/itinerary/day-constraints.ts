import { TRIP_DAY_COUNT } from "@/lib/constants";
import type { PlaceCategory } from "@/lib/importers/types";
import {
  DEFAULT_DAY_START_MINUTES,
  DAY_END_WARNING_MINUTES,
  formatScheduleTime,
  parseTimeToMinutes,
} from "@/lib/itinerary/schedule-day";
import { PLACE_CATEGORIES } from "@/lib/places/place-detail";

export type TripDayConstraintsInput = {
  flightDeparture: string | null;
  airportTransferMinutes: number;
};

export type ItineraryDayConstraintsInput = {
  id: string;
  dayNumber: number;
  date: string | null;
  focus: string | null;
  dayEndOverride: string | null;
};

export type DayEndSource = "manual" | "flight" | "default";

export type ResolvedDayConstraints = {
  focus: string | null;
  focusCategory: PlaceCategory | null;
  focusLabel: string | null;
  dayEndMinutes: number;
  dayActiveMinutesLimit: number;
  dayEndSource: DayEndSource;
};

export function normalizeFocusText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function resolveFocusCategory(
  focus: string | null | undefined,
): PlaceCategory | null {
  if (!focus?.trim()) {
    return null;
  }

  const normalized = normalizeFocusText(focus);

  for (const category of PLACE_CATEGORIES) {
    if (normalizeFocusText(category) === normalized) {
      return category;
    }
  }

  for (const category of PLACE_CATEGORIES) {
    const categoryNormalized = normalizeFocusText(category);
    if (
      categoryNormalized.includes(normalized) ||
      normalized.includes(categoryNormalized)
    ) {
      return category;
    }
  }

  return null;
}

export function resolveDayConstraints(
  day: ItineraryDayConstraintsInput,
  trip: TripDayConstraintsInput,
  allDays: ItineraryDayConstraintsInput[],
): ResolvedDayConstraints {
  const focus = day.focus?.trim() || null;
  const focusCategory = resolveFocusCategory(focus);
  const focusLabel = focus;

  let dayEndMinutes = DAY_END_WARNING_MINUTES;
  let dayEndSource: DayEndSource = "default";

  const manualOverride = parseTimeToMinutes(day.dayEndOverride);
  if (manualOverride != null) {
    dayEndMinutes = manualOverride;
    dayEndSource = "manual";
  } else {
    const flightEndMinutes = computeFlightDayEndMinutes(day, trip, allDays);
    if (flightEndMinutes != null) {
      dayEndMinutes = flightEndMinutes;
      dayEndSource = "flight";
    }
  }

  const dayActiveMinutesLimit = Math.max(0, dayEndMinutes - DEFAULT_DAY_START_MINUTES);

  return {
    focus,
    focusCategory,
    focusLabel,
    dayEndMinutes,
    dayActiveMinutesLimit,
    dayEndSource,
  };
}

function computeFlightDayEndMinutes(
  day: ItineraryDayConstraintsInput,
  trip: TripDayConstraintsInput,
  allDays: ItineraryDayConstraintsInput[],
): number | null {
  if (!trip.flightDeparture) {
    return null;
  }

  const flightDate = new Date(trip.flightDeparture);
  if (Number.isNaN(flightDate.getTime())) {
    return null;
  }

  if (!isFlightDepartureDay(day, flightDate, allDays)) {
    return null;
  }

  const cutoff = new Date(
    flightDate.getTime() - trip.airportTransferMinutes * 60_000,
  );

  return cutoff.getHours() * 60 + cutoff.getMinutes();
}

function isFlightDepartureDay(
  day: ItineraryDayConstraintsInput,
  flightDate: Date,
  allDays: ItineraryDayConstraintsInput[],
): boolean {
  const flightDateOnly = formatDateOnly(flightDate);
  const dayWithMatchingDate = allDays.find(
    (candidate) => candidate.date && candidate.date.startsWith(flightDateOnly),
  );

  if (dayWithMatchingDate) {
    return dayWithMatchingDate.id === day.id;
  }

  const hasAnyDates = allDays.some((candidate) => Boolean(candidate.date?.trim()));
  if (hasAnyDates) {
    return false;
  }

  const lastDayNumber = Math.min(
    TRIP_DAY_COUNT,
    Math.max(...allDays.map((candidate) => candidate.dayNumber)),
  );
  return day.dayNumber === lastDayNumber;
}

function formatDateOnly(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function formatDayEndSourceLabel(source: DayEndSource): string {
  switch (source) {
    case "manual":
      return "hora manual";
    case "flight":
      return "vuelo de regreso";
    default:
      return "predeterminada (22:00)";
  }
}

export function formatDayEndMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const isoTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
  return formatScheduleTime(isoTime);
}

export function toTimeInputValue(value: string | null | undefined): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) {
    return "";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function fromTimeInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const minutes = parseTimeToMinutes(trimmed);
  if (minutes == null) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

export function formatDayTabLabel(dayNumber: number, focus: string | null | undefined): string {
  const trimmedFocus = focus?.trim();
  if (!trimmedFocus) {
    return `Día ${dayNumber}`;
  }

  const normalized = trimmedFocus.charAt(0).toUpperCase() + trimmedFocus.slice(1);
  return `Día ${dayNumber} · ${normalized}`;
}
