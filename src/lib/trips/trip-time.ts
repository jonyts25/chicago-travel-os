export const DEFAULT_TRIP_TIMEZONE = "America/Chicago";

export type TripDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function resolveTripTimezone(timezone: string | null | undefined): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_TRIP_TIMEZONE;
}

function getPartsFormatter(timezone?: string | null): Intl.DateTimeFormat {
  const resolved = resolveTripTimezone(timezone);
  let formatter = partsFormatterCache.get(resolved);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormatterCache.set(resolved, formatter);
  }

  return formatter;
}

export function getTripDateTimeParts(
  input: Date | string,
  timezone?: string | null,
): TripDateTimeParts | null {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getPartsFormatter(timezone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hours = read("hour");
  const minutes = read("minute");
  const seconds = read("second");

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  return { year, month, day, hours, minutes, seconds };
}

export function formatInTripTimeZone(
  input: Date | string,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "es-MX",
): string | null {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(locale, {
    timeZone: resolveTripTimezone(timezone),
    ...options,
  });
}

export function getTripClockMinutes(
  input: Date | string,
  timezone?: string | null,
): number | null {
  const parts = getTripDateTimeParts(input, timezone);
  if (!parts) {
    return null;
  }

  return parts.hours * 60 + parts.minutes;
}

export function getTripDateOnlyString(
  input: Date | string,
  timezone?: string | null,
): string | null {
  const parts = getTripDateTimeParts(input, timezone);
  if (!parts) {
    return null;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getTripClockMinutesNow(
  timezone?: string | null,
  referenceDate: Date = new Date(),
): number | null {
  return getTripClockMinutes(referenceDate, timezone);
}

export function tripLocalDateTimeToUtcDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone?: string | null,
): Date | null {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  let utcMs = Date.UTC(year, month - 1, day, hours, minutes);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const parts = getTripDateTimeParts(new Date(utcMs), timezone);
    if (!parts) {
      return null;
    }

    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hours === hours &&
      parts.minutes === minutes
    ) {
      return new Date(utcMs);
    }

    const targetMs = Date.UTC(year, month - 1, day, hours, minutes);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours,
      parts.minutes,
    );
    utcMs -= actualMs - targetMs;
  }

  return null;
}

export function isoToTripDatetimeLocalValue(
  iso: string | null | undefined,
  timezone?: string | null,
): string {
  if (!iso?.trim()) {
    return "";
  }

  const parts = getTripDateTimeParts(iso, timezone);
  if (!parts) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`;
}

export function tripDatetimeLocalValueToIso(
  value: string,
  timezone?: string | null,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes)
  ) {
    return null;
  }

  const date = tripLocalDateTimeToUtcDate(year, month, day, hours, minutes, timezone);
  if (!date) {
    return null;
  }

  const roundTrip = isoToTripDatetimeLocalValue(date.toISOString(), timezone);
  if (roundTrip !== trimmed.slice(0, 16)) {
    return null;
  }

  return date.toISOString();
}
