import Link from "next/link";
import { TripMapLoader } from "@/components/map/trip-map-loader";
import { SignOutButton } from "@/components/sign-out-button";
import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { hasCoordinates, type PlaceMapMarker } from "@/lib/places/schema";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/map");
  }

  const { data: rows, error } = await supabase
    .from("places")
    .select("id, name, lat, lng, category, status, address")
    .eq("trip_id", CHICAGO_TRIP_ID)
    .not("lat", "is", null)
    .not("lng", "is", null);

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Mapa
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Lugares en Chicago
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {places.length} lugar{places.length === 1 ? "" : "es"} con
            coordenadas · tiles OpenStreetMap (sin API key)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

      {places.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 text-sm text-slate-400">
          Aún no hay lugares con coordenadas. Importa tu CSV en{" "}
          <Link href="/import" className="font-medium text-blue-400 hover:text-blue-300">
            /import
          </Link>{" "}
          y vuelve aquí.
        </section>
      ) : null}

      <div className="min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-800">
        <TripMapLoader places={places} />
      </div>
    </div>
  );
}
