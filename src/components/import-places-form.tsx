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
          CSV de Google Takeout (Saved)
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
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

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Importados" value={result.imported} tone="emerald" />
            <SummaryCard label="Actualizados" value={result.updated} tone="blue" />
            <SummaryCard
              label="Sin coordenadas"
              value={result.withoutCoordinates}
              tone="slate"
            />
            <SummaryCard
              label="Sin categoría IA"
              value={result.withoutAiCategory}
              tone="slate"
            />
            <SummaryCard
              label="Sin CID en URL"
              value={result.skippedNoId}
              tone="slate"
            />
          </dl>

          {result.errors.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {result.errors.map((error) => (
                <li
                  key={error}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    result.imported > 0 || result.updated > 0
                      ? "border-amber-500/40 bg-amber-950/40 text-amber-100"
                      : "border-red-500/40 bg-red-950/40 text-red-200"
                  }`}
                >
                  {error}
                </li>
              ))}
            </ul>
          ) : null}

          {result.errors.length === 0 &&
          result.imported === 0 &&
          result.updated > 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Se reimportaron {result.updated} lugar(es) existentes (geocodificación
              y/o categoría IA).
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "slate";
}) {
  const styles = {
    emerald: "border-emerald-500/30 bg-emerald-950/30 text-emerald-300",
    blue: "border-blue-500/30 bg-blue-950/30 text-blue-300",
    slate: "border-slate-700 bg-slate-900/60 text-slate-400",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${styles[tone]}`}>
      <dt>{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-white">{value}</dd>
    </div>
  );
}
