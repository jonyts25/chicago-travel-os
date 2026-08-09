import Link from "next/link";
import { ImportPlacesForm } from "@/components/import-places-form";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/import");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Importación
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Lugares de Google Maps
          </h1>
        </div>
        <div className="flex items-center gap-3">
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
        <p className="text-sm text-slate-400">
          Sube el CSV de Google Takeout → Saved (columnas{" "}
          <span className="text-slate-300">
            Título, Nota, URL, Etiquetas, Comentario
          </span>
          ). El CID se extrae de la URL (
          <code className="text-slate-300">!1s0x…:0x…</code>
          ), las coordenadas se resuelven con Nominatim (1 req/s) y la
          categoría/nombre se enriquecen opcionalmente con IA (Haiku).
        </p>

        <div className="mt-6">
          <ImportPlacesForm />
        </div>
      </section>
    </div>
  );
}
