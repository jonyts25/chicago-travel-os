import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Chicago Travel OS
          </h1>
        </div>
        <SignOutButton />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <h2 className="text-lg font-medium text-white">Sesión activa</h2>
        <p className="mt-2 text-sm text-slate-400">
          Conectado como{" "}
          <span className="font-medium text-slate-200">{user.email}</span>
        </p>
        <p className="mt-4 text-sm text-slate-500">
          <Link href="/import" className="font-medium text-blue-400 hover:text-blue-300">
            /import
          </Link>{" "}
          para lugares ·{" "}
          <Link
            href="/import/agregar"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            /import/agregar
          </Link>{" "}
          para pegar un enlace ·{" "}
          <Link href="/map" className="font-medium text-blue-400 hover:text-blue-300">
            /map
          </Link>{" "}
          para ver el mapa ·{" "}
          <Link
            href="/planificar"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            /planificar
          </Link>{" "}
          para armar el itinerario día a día ·{" "}
          <Link href="/hoy" className="font-medium text-emerald-400 hover:text-emerald-300">
            /hoy
          </Link>{" "}
          para el modo viaje activo en el celular ·{" "}
          <Link
            href="/preferencias"
            className="font-medium text-violet-400 hover:text-violet-300"
          >
            /preferencias
          </Link>{" "}
          para tus gustos del viaje (sugerencias IA).
        </p>
      </section>

      <Link
        href="/preferencias"
        className="block rounded-2xl border border-violet-500/40 bg-violet-950/30 p-6 transition hover:border-violet-400/60 hover:bg-violet-950/50"
      >
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-violet-400">
          Gustos del viaje
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">Editar preferencias</h2>
        <p className="mt-2 text-sm text-violet-100/80">
          Texto libre por usuario — la IA lo usa para sugerir lugares en /planificar.
        </p>
      </Link>

      <Link
        href="/hoy"
        className="block rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-6 transition hover:border-emerald-400/60 hover:bg-emerald-950/50"
      >
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-emerald-400">
          En el viaje
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">Abrir modo Hoy</h2>
        <p className="mt-2 text-sm text-emerald-100/80">
          Próximo bloque, navegación y acciones rápidas — pensado para usar de pie en la calle.
        </p>
      </Link>
    </div>
  );
}
