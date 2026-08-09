import Link from "next/link";
import { TripMapLoader } from "@/components/map/trip-map-loader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PLACE_STATUS_UNPLANNED } from "@/lib/constants";
import { hasCoordinates, type PlaceMapMarker } from "@/lib/places/schema";
import { tripPaths } from "@/lib/trips/trip-paths";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MapPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{
    pool?: string;
    nearLat?: string;
    nearLng?: string;
  }>;
};

function parseCoordinate(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const { tripId } = await params;
  const paths = tripPaths(tripId);

  const routeParams = await searchParams;
  const pool = routeParams.pool?.trim().toLowerCase();
  const filterUnplanned = pool === "unplanned";
  const nearLat = parseCoordinate(routeParams.nearLat);
  const nearLng = parseCoordinate(routeParams.nearLng);
  const hasNearPoint = nearLat != null && nearLng != null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/trips/${tripId}/map`);
  }

  let query = supabase
    .from("places")
    .select("id, name, lat, lng, category, status, address")
    .eq("trip_id", tripId)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (filterUnplanned) {
    query = query.eq("status", PLACE_STATUS_UNPLANNED);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new Error(`Error al cargar lugares: ${error.message}`);
  }

  const places: PlaceMapMarker[] = (rows ?? []).flatMap((row) => {
    if (!hasCoordinates(row)) {
      return [];
    }

    return [
      {
        id: row.id,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        category: row.category,
        status: row.status,
        address: row.address,
      },
    ];
  });

  const subtitle = filterUnplanned
    ? `${places.length} lugar${places.length === 1 ? "" : "es"} sin planificar`
    : `${places.length} lugar${places.length === 1 ? "" : "es"} con coordenadas`;

  return (
    <PageContainer size="lg">
      <PageHeader
        eyebrow="Mapa"
        title={filterUnplanned ? "Alternativas cercanas" : "Lugares del viaje"}
        subtitle={`${subtitle}${filterUnplanned ? " · solo sin planificar" : ""}${hasNearPoint ? " · centrado cerca del bloque actual" : ""} · OpenStreetMap`}
      />

      {filterUnplanned ? (
        <Card tone="warning" className="mb-4 !py-4">
          <p className="text-sm text-amber-100/90">
            Mostrando lugares sin planificar como alternativas.{" "}
            <Link href={paths.map} className="font-medium text-amber-200 underline-offset-2 hover:underline">
              Ver todos
            </Link>
          </p>
        </Card>
      ) : null}

      {places.length === 0 ? (
        <EmptyState
          title="Sin lugares en el mapa"
          description={
            filterUnplanned
              ? "No hay lugares sin planificar con coordenadas. Importa más o libera lugares desde planificación."
              : "Aún no hay lugares con coordenadas. Importa tu CSV para empezar."
          }
          action={
            <Link href={paths.import}>
              <Button>Ir a importar</Button>
            </Link>
          }
        />
      ) : (
        <div className="min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-slate-800">
          <TripMapLoader
            places={places}
            initialCenter={hasNearPoint ? [nearLat, nearLng] : undefined}
            initialZoom={hasNearPoint ? 14 : undefined}
          />
        </div>
      )}
    </PageContainer>
  );
}
