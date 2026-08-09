import { type TripType, isScheduledTrip } from "@/lib/trips/types";

export function tripPaths(tripId: string) {
  const base = `/trips/${tripId}`;

  return {
    root: base,
    dashboard: `${base}/dashboard`,
    hoy: `${base}/hoy`,
    planificar: `${base}/planificar`,
    planificarLugares: `${base}/planificar/lugares`,
    lugares: `${base}/lugares`,
    map: `${base}/map`,
    import: `${base}/import`,
    importAgregar: `${base}/import/agregar`,
    preferencias: `${base}/preferencias`,
  };
}

export function tripDefaultPath(tripId: string, tripType: TripType): string {
  return isScheduledTrip(tripType)
    ? tripPaths(tripId).dashboard
    : tripPaths(tripId).lugares;
}

export function revalidateTripPaths(tripId: string): string[] {
  const paths = tripPaths(tripId);
  return [
    paths.dashboard,
    paths.hoy,
    paths.planificar,
    paths.planificarLugares,
    paths.lugares,
    paths.map,
    paths.import,
    paths.importAgregar,
    paths.preferencias,
    "/",
  ];
}
