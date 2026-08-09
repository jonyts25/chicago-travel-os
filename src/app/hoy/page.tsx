import Link from "next/link";
import { TodayView } from "@/components/hoy/today-view";
import { SignOutButton } from "@/components/sign-out-button";
import { loadTodayPageContext } from "@/lib/hoy/load-today-data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HoyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/hoy");
  }

  const { context, error } = await loadTodayPageContext();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
            Modo hoy
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">En el viaje</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Inicio
          </Link>
          <SignOutButton />
        </div>
      </div>

      {error || !context ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6">
          <h2 className="text-lg font-medium text-red-100">Error al cargar</h2>
          <p className="mt-2 text-sm text-red-200">
            {error ?? "No se pudo cargar el contexto del viaje."}
          </p>
        </section>
      ) : (
        <TodayView context={context} />
      )}
    </div>
  );
}
