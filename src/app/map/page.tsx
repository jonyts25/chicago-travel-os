import Link from "next/link";
import { TripMapLoader } from "@/components/map/trip-map-loader";
import { SignOutButton } from "@/components/sign-out-button";
import { CHICAGO_TRIP_ID, PLACE_STATUS_UNPLANNED } from "@/lib/constants";
import { hasCoordinates, type PlaceMapMarker } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type MapPageProps = {
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

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = await searchParams;
  const pool = params.pool?.trim().toLowerCase();
  const filterUnplanned = pool === "unplanned";
  const nearLat = parseCoordinate(params.nearLat);
  const nearLng = parseCoordinate(params.nearLng);
  const hasNearPoint = nearLat != null && nearLng != null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/map");
  }

  let query = supabase
    .from("places")
    .select("id, name, lat, lng, category, status, address")
    .eq("trip_id", CHICAGO_TRIP_ID)
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Mapa
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {filterUnplanned ? "Alternativas cercanas" : "Lugares en Chicago"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {subtitle}
            {filterUnplanned ? " · solo pool sin planificar" : ""}
            {hasNearPoint ? " · centrado cerca del bloque actual" : ""}
            {" · tiles OpenStreetMap (sin API key)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/hoy"
            className="rounded-lg border border-emerald-700/60 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-950/40"
          >
            Modo hoy
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <Link
            href="/import"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Importar
          </Link>
          <SignOutButton />
        </div>
      </div>

      {filterUnplanned ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Mostrando lugares <strong>unplanned</strong> como alternativas.{" "}
          <Link href="/map" className="font-medium text-amber-200 underline-offset-2 hover:underline">
            Ver todos los lugares
          </Link>
        </section>
      ) : null}

      {places.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-sm text-slate-400">
          {filterUnplanned ? (
            <>
              No hay lugares sin planificar con coordenadas. Importa más en{" "}
              <Link href="/import" className="font-medium text-blue-400 hover:text-blue-300">
                /import
              </Link>{" "}
              o libera lugares desde{" "}
              <Link href="/planificar" className="font-medium text-blue-400 hover:text-blue-300">
                /planificar
              </Link>
              .
            </>
          ) : (
            <>
              Aún no hay lugares con coordenadas. Importa tu CSV en{" "}
              <Link href="/import" className="font-medium text-blue-400 hover:text-blue-300">
                /import
              </Link>{" "}
              y vuelve aquí.
            </>
          )}
        </section>
      ) : null}

      <div className="min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-800">
        <TripMapLoader
          places={places}
          initialCenter={hasNearPoint ? [nearLat, nearLng] : undefined}
          initialZoom={hasNearPoint ? 14 : undefined}
        />
      </div>
    </div>
  );
}
