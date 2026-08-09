import Link from "next/link";
import { PreferencesForm } from "@/components/preferencias/preferences-form";
import { SignOutButton } from "@/components/sign-out-button";
import { CHICAGO_TRIP_ID } from "@/lib/constants";
import { getUserPreferencesAction } from "@/app/preferencias/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/preferencias");
  }

  const preferencesResult = await getUserPreferencesAction();
  const { data: trip } = await supabase
    .from("trips")
    .select("base_location")
    .eq("id", CHICAGO_TRIP_ID)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Preferencias
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Tus gustos del viaje</h1>
          <p className="mt-2 text-sm text-slate-400">
            Cada viajero edita las suyas con su cuenta. Se usan para sugerencias de lugares con IA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <h2 className="text-lg font-medium text-white">Hotel / base del viaje</h2>
        <p className="mt-2 text-sm text-slate-300">
          {trip?.base_location?.trim() || "Aún no hay base_location configurada en el trip."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Este dato vive en Supabase (`trips.base_location`) y la IA lo usa para sugerir lugares
          cercanos.
        </p>
      </section>

      {!preferencesResult.ok ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6">
          <p className="text-sm text-red-200">{preferencesResult.error}</p>
        </section>
      ) : (
        <PreferencesForm
          initialPreferences={preferencesResult.preferences ?? ""}
          userEmail={user.email ?? ""}
        />
      )}
    </div>
  );
}
