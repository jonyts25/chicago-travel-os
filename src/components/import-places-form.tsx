"use client";

import { FormEvent, useState } from "react";
import { importPlacesAction } from "@/app/import/actions";
import type { ImportPlacesResult } from "@/lib/importers/types";

export function ImportPlacesForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<ImportPlacesResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const summary = await importPlacesAction(formData);

    setResult(summary);
    setStatus("done");
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
          Archivo de Google Takeout
          <input
            type="file"
            name="file"
            accept=".json,.geojson,.csv,application/json,text/csv"
            required
            onChange={(event) => {
              const selected = event.target.files?.[0];
              setFileName(selected?.name ?? null);
            }}
            className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
          />
        </label>

        {fileName ? (
          <p className="text-sm text-slate-400">Seleccionado: {fileName}</p>
        ) : null}

        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Importando..." : "Importar lugares"}
        </button>
      </form>

      {result ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5">
          <h2 className="text-lg font-medium text-white">Resumen de importación</h2>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3">
              <dt className="text-emerald-300">Importados</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">
                {result.imported}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3">
              <dt className="text-amber-300">Duplicados</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">
                {result.duplicates}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
              <dt className="text-slate-400">Omitidos</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">
                {result.skipped}
              </dd>
            </div>
          </dl>

          {result.errors.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {result.errors.map((error) => (
                <li
                  key={error}
                  className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200"
                >
                  {error}
                </li>
              ))}
            </ul>
          ) : null}

          {result.errors.length === 0 && result.imported === 0 && result.duplicates > 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Todos los lugares del archivo ya existían para este viaje.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
