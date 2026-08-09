import { ACTIVE_DAY_STORAGE_KEY } from "@/lib/hoy/today-types";

export function getStoredActiveDay(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_DAY_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    return null;
  }

  return parsed;
}

export function setStoredActiveDay(dayNumber: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_DAY_STORAGE_KEY, String(dayNumber));
}
