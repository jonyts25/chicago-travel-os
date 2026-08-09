"use client";

import { FormEvent, useState } from "react";
import { importPlacesAction } from "@/app/import/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import { inputs, surfaces, typography } from "@/lib/ui/styles";
import type { ImportPlacesResult } from "@/lib/importers/types";

export function ImportPlacesForm({ tripId }: { tripId: string }) {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<ImportPlacesResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const summary = await importPlacesAction(tripId, formData);

    setResult(summary);
    setStatus("done");

    if (summary.imported > 0 || summary.updated > 0) {
      showToast(
        `${summary.imported} importados, ${summary.updated} actualizados`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={inputs.label}>
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
            className={`${inputs.base} file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500`}
          />
        </label>

        {fileName ? <p className={typography.secondary}>Seleccionado: {fileName}</p> : null}

        <Button type="submit" loading={status === "loading"}>
          Importar lugares
        </Button>
      </form>

      {result ? (
        <Card title="Resumen de importación">
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Importados" value={result.imported} tone="success" />
            <SummaryCard label="Actualizados" value={result.updated} tone="accent" />
            <SummaryCard label="Sin coordenadas" value={result.withoutCoordinates} />
            <SummaryCard label="Sin categoría IA" value={result.withoutAiCategory} />
            <SummaryCard label="Sin CID en URL" value={result.skippedNoId} />
          </dl>

          {result.errors.length > 0 ? (
            <div className="mt-4 space-y-2">
              {result.errors.map((error) => (
                <ErrorMessage
                  key={error}
                  message={
                    result.imported > 0 || result.updated > 0
                      ? "La importación terminó con advertencias."
                      : "No pudimos completar la importación."
                  }
                  technicalDetails={error}
                />
              ))}
            </div>
          ) : null}

          {result.errors.length === 0 && result.imported === 0 && result.updated > 0 ? (
            <p className={`${typography.secondary} mt-4`}>
              Se reimportaron {result.updated} lugar(es) existentes.
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "success" | "accent" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-950/30"
      : tone === "accent"
        ? "border-blue-500/30 bg-blue-950/30"
        : surfaces.inset;

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <dt className={typography.secondary}>{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-white">{value}</dd>
    </div>
  );
}
