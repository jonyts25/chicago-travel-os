export const TRIP_TIMEZONE = "America/Chicago";

export type ChicagoDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const chicagoPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TRIP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function getChicagoDateTimeParts(
  input: Date | string,
): ChicagoDateTimeParts | null {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = chicagoPartsFormatter.formatToParts(date);
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

export function formatInChicagoTimeZone(
  input: Date | string,
  options: Intl.DateTimeFormatOptions,
  locale = "es-MX",
): string | null {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(locale, {
    timeZone: TRIP_TIMEZONE,
    ...options,
  });
}

export function getChicagoClockMinutes(input: Date | string): number | null {
  const parts = getChicagoDateTimeParts(input);
  if (!parts) {
    return null;
  }

  return parts.hours * 60 + parts.minutes;
}

export function getChicagoDateOnlyString(input: Date | string): string | null {
  const parts = getChicagoDateTimeParts(input);
  if (!parts) {
    return null;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getChicagoClockMinutesNow(referenceDate: Date = new Date()): number | null {
  return getChicagoClockMinutes(referenceDate);
}

export function chicagoLocalDateTimeToUtcDate(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
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
    const parts = getChicagoDateTimeParts(new Date(utcMs));
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

export function isoToChicagoDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "";
  }

  const parts = getChicagoDateTimeParts(iso);
  if (!parts) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`;
}

export function chicagoDatetimeLocalValueToIso(value: string): string | null {
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

  const date = chicagoLocalDateTimeToUtcDate(year, month, day, hours, minutes);
  if (!date) {
    return null;
  }

  const roundTrip = isoToChicagoDatetimeLocalValue(date.toISOString());
  if (roundTrip !== trimmed.slice(0, 16)) {
    return null;
  }

  return date.toISOString();
}
