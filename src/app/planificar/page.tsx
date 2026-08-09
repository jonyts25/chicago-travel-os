import Link from "next/link";
import { PlanningBoard } from "@/components/planificar/planning-board";
import { SignOutButton } from "@/components/sign-out-button";
import { loadPlanningBoardData } from "@/lib/itinerary/load-planning-data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlanificarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/planificar");
  }

  const { data, error } = await loadPlanningBoardData();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Planificación
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Itinerario de 4 días
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <Link
            href="/map"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Mapa
          </Link>
          <SignOutButton />
        </div>
      </div>

      {error ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6">
          <h2 className="text-lg font-medium text-red-100">Error al cargar</h2>
          <p className="mt-2 text-sm text-red-200">{error}</p>
        </section>
      ) : data ? (
        <PlanningBoard
          days={data.days}
          unplannedPlaces={data.unplannedPlaces}
          unlocatedPlaces={data.unlocatedPlaces}
        />
      ) : null}
    </div>
  );
}
