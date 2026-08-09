import {
  DEFAULT_DAY_START_MINUTES,
  DAY_END_WARNING_MINUTES,
  formatScheduleTime,
} from "@/lib/itinerary/schedule-day";
import { TRIP_DAY_COUNT } from "@/lib/constants";

export const ARRIVAL_BUFFER_MINUTES = 120;

export type TripTravelSettings = {
  start_date: string | null;
  flight_arrival: string | null;
  flight_departure: string | null;
  flight_outbound_number: string | null;
  flight_return_number: string | null;
  hotel_checkin: string | null;
  hotel_checkout: string | null;
  base_location: string | null;
  airport_transfer_minutes: number;
};

export type ExtractedTravelConfirmation = {
  detectedType: "vuelo_ida" | "vuelo_vuelta" | "hotel" | "desconocido";
  flight_arrival: string | null;
  flight_departure: string | null;
  flight_outbound_number: string | null;
  flight_return_number: string | null;
  hotel_checkin: string | null;
  hotel_checkout: string | null;
  base_location: string | null;
  summary: string | null;
};

export function resolveDayStartMinutesFromArrival(
  flightArrival: string | null | undefined,
): number {
  if (!flightArrival?.trim()) {
    return DEFAULT_DAY_START_MINUTES;
  }

  const arrival = new Date(flightArrival);
  if (Number.isNaN(arrival.getTime())) {
    return DEFAULT_DAY_START_MINUTES;
  }

  const readyTime = new Date(arrival.getTime() + ARRIVAL_BUFFER_MINUTES * 60_000);
  let minutes = readyTime.getHours() * 60 + readyTime.getMinutes();
  minutes = Math.ceil(minutes / 30) * 30;

  return Math.max(7 * 60, Math.min(minutes, DAY_END_WARNING_MINUTES - 60));
}

export function formatTripDateTime(
  iso: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string | null {
  if (!iso?.trim()) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  });
}

export function formatTripTimeFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hours = date.getHours();
  const mins = date.getMinutes();
  const isoTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
  return formatScheduleTime(isoTime);
}

export function formatDayStartSourceLabel(
  dayNumber: number,
  flightArrival: string | null | undefined,
): string {
  if (dayNumber !== 1 || !flightArrival?.trim()) {
    return "9:00 AM";
  }

  const minutes = resolveDayStartMinutesFromArrival(flightArrival);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${formatScheduleTime(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`)} (llegada + 2 h)`;
}

export function getDayTravelReminder(
  dayNumber: number,
  settings: TripTravelSettings,
): string | null {
  if (dayNumber === 1 && settings.flight_arrival) {
    const time = formatTripTimeFromIso(settings.flight_arrival);
    const flight = settings.flight_outbound_number?.trim();
    if (time && flight) {
      return `Llegada: vuelo ${flight} a las ${time}`;
    }
    if (time) {
      return `Llegada a Chicago a las ${time}`;
    }
  }

  if (dayNumber === TRIP_DAY_COUNT && settings.flight_departure) {
    const time = formatTripTimeFromIso(settings.flight_departure);
    const flight = settings.flight_return_number?.trim();
    const transfer = settings.airport_transfer_minutes;
    if (time && flight) {
      return `Salida: vuelo ${flight} a las ${time} — recuerda salir al aeropuerto con ${transfer} min de anticipación`;
    }
    if (time) {
      return `Salida de Chicago a las ${time} — recuerda salir al aeropuerto con ${transfer} min de anticipación`;
    }
  }

  return null;
}

export function hasAnyTripTravelInfo(settings: TripTravelSettings): boolean {
  return Boolean(
    settings.flight_arrival ||
      settings.flight_departure ||
      settings.flight_outbound_number ||
      settings.flight_return_number ||
      settings.hotel_checkin ||
      settings.hotel_checkout ||
      settings.base_location,
  );
}

export const TRIP_TRAVEL_SELECT =
  "start_date, flight_arrival, flight_departure, flight_outbound_number, flight_return_number, hotel_checkin, hotel_checkout, base_location, airport_transfer_minutes";

export function normalizeTripTravelSettings(
  row: Partial<TripTravelSettings> | null | undefined,
): TripTravelSettings {
  return {
    start_date: row?.start_date ?? null,
    flight_arrival: row?.flight_arrival ?? null,
    flight_departure: row?.flight_departure ?? null,
    flight_outbound_number: row?.flight_outbound_number?.trim() || null,
    flight_return_number: row?.flight_return_number?.trim() || null,
    hotel_checkin: row?.hotel_checkin ?? null,
    hotel_checkout: row?.hotel_checkout ?? null,
    base_location: row?.base_location?.trim() || null,
    airport_transfer_minutes: row?.airport_transfer_minutes ?? 90,
  };
}
