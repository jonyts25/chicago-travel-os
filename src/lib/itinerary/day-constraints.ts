import { TRIP_DAY_COUNT } from "@/lib/constants";
import type { PlaceCategory } from "@/lib/importers/types";
import {
  DAY_END_WARNING_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  formatScheduleTime,
  parseTimeToMinutes,
} from "@/lib/itinerary/schedule-day";
import { PLACE_CATEGORIES } from "@/lib/places/place-detail";
import {
  getFlightDepartureCutoffMinutes,
  resolveDayStartMinutesFromArrival,
} from "@/lib/trips/travel-info";
import {
  getTripDateOnlyString,
  isoToTripDatetimeLocalValue,
  tripDatetimeLocalValueToIso,
} from "@/lib/trips/trip-time";

export type TripDayConstraintsInput = {
  timezone?: string | null;
  flightArrival: string | null;
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
export type DayStartSource = "flight_arrival" | "default";

export type ResolvedDayConstraints = {
  focus: string | null;
  focusCategory: PlaceCategory | null;
  focusLabel: string | null;
  dayStartMinutes: number;
  dayStartSource: DayStartSource;
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

  let dayStartMinutes = DEFAULT_DAY_START_MINUTES;
  let dayStartSource: DayStartSource = "default";

  if (day.dayNumber === 1 && trip.flightArrival?.trim()) {
    dayStartMinutes = resolveDayStartMinutesFromArrival(
      trip.flightArrival,
      trip.timezone,
    );
    dayStartSource = "flight_arrival";
  }

  let dayEndMinutes = DAY_END_WARNING_MINUTES;
  let dayEndSource: DayEndSource = "default";

  const manualOverride = parseTimeToMinutes(day.dayEndOverride);
  if (manualOverride != null) {
    dayEndMinutes = manualOverride;
    dayEndSource = "manual";
  } else {
    const flightEndMinutes = safeComputeFlightDayEndMinutes(day, trip, allDays);
    if (flightEndMinutes != null) {
      dayEndMinutes = flightEndMinutes;
      dayEndSource = "flight";
    }
  }

  const dayActiveMinutesLimit = Math.max(0, dayEndMinutes - dayStartMinutes);

  return {
    focus,
    focusCategory,
    focusLabel,
    dayStartMinutes,
    dayStartSource,
    dayEndMinutes,
    dayActiveMinutesLimit,
    dayEndSource,
  };
}

function safeComputeFlightDayEndMinutes(
  day: ItineraryDayConstraintsInput,
  trip: TripDayConstraintsInput,
  allDays: ItineraryDayConstraintsInput[],
): number | null {
  try {
    const minutes = computeFlightDayEndMinutes(day, trip, allDays);
    if (minutes == null || !Number.isFinite(minutes)) {
      return null;
    }

    if (minutes < 0 || minutes > 24 * 60) {
      console.error(
        "[day-constraints] Invalid flight day end minutes:",
        minutes,
        { dayNumber: day.dayNumber, flightDeparture: trip.flightDeparture },
      );
      return null;
    }

    return minutes;
  } catch (error) {
    console.error(
      "[day-constraints] Flight day end calculation failed:",
      error,
      { dayNumber: day.dayNumber, flightDeparture: trip.flightDeparture },
    );
    return null;
  }
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

  if (!isFlightDepartureDay(day, flightDate, trip.timezone, allDays)) {
    return null;
  }

  return getFlightDepartureCutoffMinutes(
    trip.flightDeparture,
    trip.airportTransferMinutes,
    trip.timezone,
  );
}

function isFlightDepartureDay(
  day: ItineraryDayConstraintsInput,
  flightDate: Date,
  timezone: string | null | undefined,
  allDays: ItineraryDayConstraintsInput[],
): boolean {
  const flightDateOnly =
    getTripDateOnlyString(flightDate, timezone) ?? formatDateOnly(flightDate);
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

export function toDatetimeLocalValue(
  iso: string | null | undefined,
  timezone?: string | null,
): string {
  return isoToTripDatetimeLocalValue(iso, timezone);
}

export function fromDatetimeLocalValue(
  value: string,
  timezone?: string | null,
): string | null {
  return tripDatetimeLocalValueToIso(value, timezone);
}

export function formatDayStartSourceLabel(source: DayStartSource): string {
  switch (source) {
    case "flight_arrival":
      return "llegada + 2 h";
    default:
      return "predeterminada (9:00 AM)";
  }
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
