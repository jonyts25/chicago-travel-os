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
          <Link href="/map" className="font-medium text-blue-400 hover:text-blue-300">
            /map
          </Link>{" "}
          para ver el mapa (Leaflet + OpenStreetMap).
        </p>
      </section>
    </div>
  );
}
