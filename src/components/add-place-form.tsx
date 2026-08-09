"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { addPlaceAction } from "@/app/import/agregar/actions";
import { extractPlaceNameFromMapsUrl } from "@/lib/importers/google-maps";
import type { AddPlaceResult } from "@/lib/importers/types";
import { formatCategory } from "@/lib/planning/format";

type AddPlaceFormProps = {
  initialMapsUrl?: string;
};

export function AddPlaceForm({ initialMapsUrl = "" }: AddPlaceFormProps) {
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
    const summary = await addPlaceAction(formData);

    setResult(summary);
    setStatus("done");

    if (summary.needsManualName) {
      setShowNameField(true);
    }

    if (summary.ok) {
      setMapsUrl("");
      setManualName("");
      setShowNameField(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
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
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>

        <p className="text-xs text-slate-500">
          El enlace debe incluir el CID en{" "}
          <code className="text-slate-400">!1s0x…:0x…</code> (copia desde
          Compartir en Google Maps, no un enlace corto sin redirección).
        </p>

        {showNameField ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            Nombre del lugar
            <input
              type="text"
              name="manualName"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ej. Art Institute of Chicago"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </label>
        ) : (
          <input type="hidden" name="manualName" value={manualName} />
        )}

        {!showNameField && manualName ? (
          <p className="text-sm text-slate-400">
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

        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Agregando..." : "Agregar lugar"}
        </button>
      </form>

      {result ? (
        <section
          className={`rounded-xl border p-5 ${
            result.ok
              ? "border-emerald-500/40 bg-emerald-950/30"
              : "border-red-500/40 bg-red-950/30"
          }`}
        >
          {result.ok ? (
            <>
              <h2 className="text-lg font-medium text-emerald-100">
                {result.action === "updated"
                  ? "Lugar actualizado"
                  : "Lugar agregado"}
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-emerald-200/80">Nombre</dt>
                  <dd className="font-medium text-white">{result.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-emerald-200/80">Categoría</dt>
                  <dd className="font-medium text-white">
                    {formatCategory(result.category)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-emerald-200/80">Coordenadas</dt>
                  <dd className="font-medium text-white">
                    {result.hasCoordinates
                      ? "Encontradas (Nominatim)"
                      : "No encontradas — edita después en el mapa"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-emerald-100/80">
                El lugar quedó en{" "}
                <span className="font-medium text-white">Sin planear</span>.
                Asígnalo en{" "}
                <Link href="/planificar" className="text-blue-300 hover:text-blue-200">
                  /planificar
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-medium text-red-100">
                No se pudo agregar
              </h2>
              <ul className="mt-3 space-y-2">
                {result.errors.map((error) => (
                  <li key={error} className="text-sm text-red-200">
                    {error}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.errors.length > 0 && result.ok ? (
            <ul className="mt-4 space-y-2 border-t border-emerald-500/20 pt-4">
              {result.errors.map((error) => (
                <li key={error} className="text-sm text-amber-100">
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
