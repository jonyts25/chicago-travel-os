import { TRIP_DAY_COUNT } from "@/lib/constants";

export type TripCalendarAnchorInput = {
  startDate: string | null;
  hotelCheckin: string | null;
  flightArrival: string | null;
};

export type ResolvedTripDayCalendar = {
  calendarDate: string | null;
  calendarDateLabel: string | null;
};

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month - 1, day);

    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function formatDateOnly(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function resolveTripAnchorDate(input: TripCalendarAnchorInput): string | null {
  const candidates = [input.startDate, input.hotelCheckin, input.flightArrival];

  for (const candidate of candidates) {
    const parsed = parseDateOnly(candidate);
    if (parsed) {
      return formatDateOnly(parsed);
    }
  }

  return null;
}

export function resolveDayCalendarDate(
  anchorDate: string | null,
  dayNumber: number,
  storedDate?: string | null,
): string | null {
  const explicit = parseDateOnly(storedDate);
  if (explicit) {
    return formatDateOnly(explicit);
  }

  const anchor = parseDateOnly(anchorDate);
  if (!anchor || dayNumber < 1 || dayNumber > TRIP_DAY_COUNT) {
    return null;
  }

  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  date.setDate(date.getDate() + (dayNumber - 1));
  return formatDateOnly(date);
}

export function formatCalendarDateLabel(
  calendarDate: string | null | undefined,
): string | null {
  const parsed = parseDateOnly(calendarDate);
  if (!parsed) {
    return null;
  }

  return parsed.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolveTripDayCalendar(
  dayNumber: number,
  storedDate: string | null | undefined,
  anchorDate: string | null,
): ResolvedTripDayCalendar {
  const calendarDate = resolveDayCalendarDate(anchorDate, dayNumber, storedDate);
  return {
    calendarDate,
    calendarDateLabel: formatCalendarDateLabel(calendarDate),
  };
}

export function describeTripAnchorSource(input: TripCalendarAnchorInput): string | null {
  if (parseDateOnly(input.startDate)) {
    return "fecha de inicio del viaje";
  }

  if (parseDateOnly(input.hotelCheckin)) {
    return "check-in del hotel";
  }

  if (parseDateOnly(input.flightArrival)) {
    return "llegada del vuelo";
  }

  return null;
}

export function formatPlanningDayTabLabel(
  dayNumber: number,
  focus: string | null | undefined,
  calendarDateLabel: string | null | undefined,
): string {
  const parts = [`Día ${dayNumber}`];

  if (calendarDateLabel?.trim()) {
    parts.push(calendarDateLabel.trim());
  }

  const trimmedFocus = focus?.trim();
  if (trimmedFocus) {
    parts.push(trimmedFocus.charAt(0).toUpperCase() + trimmedFocus.slice(1));
  }

  return parts.join(" · ");
}

export function toDateInputValue(value: string | null | undefined): string {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : "";
}

export function fromDateInputValue(value: string): string | null {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : null;
}
