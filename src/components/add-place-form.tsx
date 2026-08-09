"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { addPlaceAction } from "@/app/import/agregar/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import { extractPlaceNameFromMapsUrl } from "@/lib/importers/google-maps";
import type { AddPlaceResult } from "@/lib/importers/types";
import { tripPaths } from "@/lib/trips/trip-paths";
import { formatCategory } from "@/lib/planning/format";
import { inputs, typography } from "@/lib/ui/styles";

type AddPlaceFormProps = {
  tripId: string;
  initialMapsUrl?: string;
};

export function AddPlaceForm({ tripId, initialMapsUrl = "" }: AddPlaceFormProps) {
  const { showToast } = useToast();
  const [mapsUrl, setMapsUrl] = useState(initialMapsUrl);
  const [manualName, setManualName] = useState("");
  const [showNameField, setShowNameField] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<AddPlaceResult | null>(null);

  useEffect(() => {
    if (initialMapsUrl) {
      setMapsUrl(initialMapsUrl);
      syncNameFromUrl(initialMapsUrl);
    }
  }, [initialMapsUrl]);

  function syncNameFromUrl(url: string) {
    const extracted = extractPlaceNameFromMapsUrl(url);
    if (extracted) {
      setManualName(extracted);
      setShowNameField(false);
      return;
    }

    setShowNameField(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const summary = await addPlaceAction(tripId, formData);

    setResult(summary);
    setStatus("done");

    if (summary.needsManualName) {
      setShowNameField(true);
    }

    if (summary.ok) {
      showToast(
        summary.action === "updated" ? "Lugar actualizado" : "Lugar agregado",
      );
      setMapsUrl("");
      setManualName("");
      setShowNameField(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={inputs.label}>
          Enlace de Google Maps
          <input
            type="url"
            name="mapsUrl"
            required
            value={mapsUrl}
            onChange={(event) => {
              const nextUrl = event.target.value;
              setMapsUrl(nextUrl);
              syncNameFromUrl(nextUrl);
            }}
            placeholder="https://www.google.com/maps/place/.../data=!4m2!3m1!1s0x..."
            className={inputs.base}
          />
        </label>

        <p className={typography.muted}>
          El enlace debe incluir el CID en <code className="text-slate-400">!1s0x…:0x…</code>.
        </p>

        {showNameField ? (
          <label className={inputs.label}>
            Nombre del lugar
            <input
              type="text"
              name="manualName"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ej. Art Institute of Chicago"
              className={inputs.base}
            />
          </label>
        ) : (
          <input type="hidden" name="manualName" value={manualName} />
        )}

        {!showNameField && manualName ? (
          <p className={typography.secondary}>
            Nombre detectado:{" "}
            <span className="font-medium text-slate-200">{manualName}</span>{" "}
            <button
              type="button"
              onClick={() => setShowNameField(true)}
              className="text-blue-400 hover:text-blue-300"
            >
              Editar
            </button>
          </p>
        ) : null}

        <Button type="submit" loading={status === "loading"}>
          Agregar lugar
        </Button>
      </form>

      {result ? (
        <Card tone={result.ok ? "success" : "default"} title={result.ok ? (result.action === "updated" ? "Lugar actualizado" : "Lugar agregado") : undefined}>
          {result.ok ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className={typography.secondary}>Nombre</dt>
                  <dd className="font-medium text-white">{result.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className={typography.secondary}>Categoría</dt>
                  <dd className="font-medium text-white">{formatCategory(result.category)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className={typography.secondary}>Coordenadas</dt>
                  <dd className="font-medium text-white">
                    {result.hasCoordinates ? "Encontradas" : "No encontradas"}
                  </dd>
                </div>
              </dl>
              <p className={`${typography.secondary} mt-4`}>
                Quedó en Sin planear. Asígnalo en{" "}
                <Link href={tripPaths(tripId).planificar} className="text-blue-400 hover:text-blue-300">
                  Planificar
                </Link>
                .
              </p>
            </>
          ) : (
            <ErrorMessage
              message="No se pudo agregar el lugar."
              technicalDetails={result.errors.join("\n")}
            />
          )}

          {result.errors.length > 0 && result.ok ? (
            <div className="mt-4 border-t border-slate-800 pt-4">
              {result.errors.map((error) => (
                <ErrorMessage
                  key={error}
                  message="El lugar se guardó con advertencias."
                  technicalDetails={error}
                />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
