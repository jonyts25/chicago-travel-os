export function getActiveDayStorageKey(tripId: string): string {
  return `travel-os-active-day:${tripId}`;
}

export function getStoredActiveDay(tripId: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getActiveDayStorageKey(tripId));
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    return null;
  }

  return parsed;
}

export function setStoredActiveDay(tripId: string, dayNumber: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getActiveDayStorageKey(tripId), String(dayNumber));
}
