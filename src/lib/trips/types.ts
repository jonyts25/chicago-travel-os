export const TRIP_TYPE_SCHEDULED = "scheduled" as const;
export const TRIP_TYPE_ONGOING = "ongoing" as const;

export type TripType = typeof TRIP_TYPE_SCHEDULED | typeof TRIP_TYPE_ONGOING;

export type TripSummary = {
  id: string;
  name: string;
  trip_type: TripType;
  start_date: string | null;
  end_date: string | null;
  timezone: string;
};

export type TripContext = TripSummary & {
  city: string | null;
};

export function normalizeTripType(value: string | null | undefined): TripType {
  return value === TRIP_TYPE_ONGOING ? TRIP_TYPE_ONGOING : TRIP_TYPE_SCHEDULED;
}

export function isScheduledTrip(tripType: TripType): boolean {
  return tripType === TRIP_TYPE_SCHEDULED;
}

export function tripTypeLabel(tripType: TripType): string {
  return tripType === TRIP_TYPE_ONGOING ? "Uso continuo" : "Viaje programado";
}
