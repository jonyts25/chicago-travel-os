import Link from "next/link";
import { Card } from "@/components/ui/card";
import { tripDefaultPath } from "@/lib/trips/trip-paths";
import { tripTypeLabel, type TripSummary } from "@/lib/trips/types";
import { cn, surfaces, typography } from "@/lib/ui/styles";

export function TripList({ trips }: { trips: TripSummary[] }) {
  if (trips.length === 0) {
    return (
      <Card title="Tus viajes">
        <p className={cn(typography.secondary, "mt-3")}>
          Aún no tienes viajes asignados. Crea uno nuevo abajo o pide acceso en Supabase.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Tus viajes" subtitle="Elige un viaje para continuar.">
      <ul className="mt-4 flex flex-col gap-3">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={tripDefaultPath(trip.id, trip.trip_type)}
              className={cn(
                surfaces.inset,
                "block px-4 py-4 transition hover:border-blue-500/40 hover:bg-blue-950/20",
              )}
            >
              <p className={typography.sectionTitle}>{trip.name}</p>
              <p className={cn(typography.secondary, "mt-1")}>
                {tripTypeLabel(trip.trip_type)}
                {trip.start_date ? ` · ${trip.start_date}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
