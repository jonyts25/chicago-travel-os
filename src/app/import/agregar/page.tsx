import Link from "next/link";
import { AddPlaceForm } from "@/components/add-place-form";
import { SignOutButton } from "@/components/sign-out-button";
import { resolveMapsUrlFromShareParams } from "@/lib/importers/google-maps";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AgregarPageProps = {
  searchParams: Promise<{
    url?: string;
    text?: string;
    title?: string;
  }>;
};

export default async function AgregarLugarPage({ searchParams }: AgregarPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/import/agregar");
  }

  const params = await searchParams;
  const initialMapsUrl = resolveMapsUrlFromShareParams(params);
  const sharedFromAndroid = Boolean(initialMapsUrl);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Agregar lugar
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Enlace de Google Maps
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/import"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Importar CSV
          </Link>
          <Link
            href="/planificar"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Planificar
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <p className="text-sm text-slate-400">
          Pega un enlace de Google Maps con el CID{" "}
          <code className="text-slate-300">!1s0x…:0x…</code>. Se geocodifica con
          Nominatim, se enriquece con IA (Haiku) y se guarda como{" "}
          <span className="text-slate-300">unplanned</span>. Si el lugar ya
          existía, se actualiza sin duplicar.
        </p>

        {sharedFromAndroid ? (
          <p className="mt-3 rounded-lg border border-blue-500/30 bg-blue-950/30 px-3 py-2 text-sm text-blue-100">
            Enlace recibido desde Compartir — revisa y confirma abajo.
          </p>
        ) : null}

        <div className="mt-6">
          <AddPlaceForm initialMapsUrl={initialMapsUrl} />
        </div>
      </section>
    </div>
  );
}
