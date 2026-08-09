/**
 * Converts Postgres `time without time zone` (e.g. "14:30:00") to `HH:MM`
 * for `<input type="time">`.
 */
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return "";
  }

  const hours = match[1].padStart(2, "0");
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

/**
 * Converts `<input type="time">` value (HH:MM) to Postgres time string HH:MM:SS.
 */
export function timeInputToDbValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatCoordinates(
  lat: number | null,
  lng: number | null,
): string {
  if (lat == null || lng == null) {
    return "Sin coordenadas";
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatTimeOfDay(value: string | null | undefined): string {
  const inputValue = toTimeInputValue(value);
  return inputValue || "—";
}
