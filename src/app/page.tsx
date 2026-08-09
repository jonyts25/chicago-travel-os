import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-400">
            PWA privada
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Chicago Travel OS
          </h1>
          <p className="text-base text-slate-400">
            Planificador de viaje para 2 usuarios. Instálala en tu teléfono y
            gestiona el itinerario de 4 días en Chicago.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex min-w-40 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Entrar
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-w-40 items-center justify-center rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
