"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  addPlaceFromSearchAction,
  searchPlacesAction,
} from "@/app/planificar/place-search-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { NominatimPlaceSearchResult } from "@/lib/geocoding/nominatim-search";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type PlaceSearchPanelProps = {
  tripId: string;
  disabled?: boolean;
  onPlaceAdded?: () => void;
};

export function PlaceSearchPanel({
  tripId,
  disabled = false,
  onPlaceAdded,
}: PlaceSearchPanelProps) {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlaceSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<NominatimPlaceSearchResult | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [isAdding, startAdding] = useTransition();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDuplicateMessage(null);
    setPendingSelection(null);
    setResults([]);

    startSearching(async () => {
      const response = await searchPlacesAction(tripId, query);
      if (!response.ok) {
        setError(response.error);
        return;
      }

      setResults(response.results);
      if (response.results.length === 0) {
        setError("No encontramos resultados en el área del viaje. Prueba otra búsqueda.");
      }
    });
  }

  function handleSelect(result: NominatimPlaceSearchResult) {
    setError(null);
    setDuplicateMessage(null);
    setPendingSelection(null);

    startAdding(async () => {
      const response = await addPlaceFromSearchAction(tripId, {
        name: result.name,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      });

      if (response.ok) {
        showToast(`"${response.name}" agregado a sin planear.`);
        setQuery("");
        setResults([]);
        onPlaceAdded?.();
        return;
      }

      if (response.needsConfirmation && response.duplicate) {
        setPendingSelection(result);
        setDuplicateMessage(
          `Ya existe "${response.duplicate.name}" a ${Math.round(response.duplicate.distanceMeters)} m. ¿Agregar de todos modos?`,
        );
        return;
      }

      setError(response.error);
    });
  }

  function handleConfirmDuplicate() {
    if (!pendingSelection) {
      return;
    }

    setError(null);
    startAdding(async () => {
      const response = await addPlaceFromSearchAction(
        tripId,
        {
          name: pendingSelection.name,
          address: pendingSelection.address,
          lat: pendingSelection.lat,
          lng: pendingSelection.lng,
        },
        { forceDuplicate: true },
      );

      if (!response.ok) {
        setError(response.error);
        return;
      }

      showToast(`"${response.name}" agregado a sin planear.`);
      setQuery("");
      setResults([]);
      setPendingSelection(null);
      setDuplicateMessage(null);
      onPlaceAdded?.();
    });
  }

  const isBusy = disabled || isSearching || isAdding;

  return (
    <Card
      title="Buscar lugar"
      subtitle="Búsqueda libre con Nominatim acotada al área del viaje. Elige el resultado correcto."
    >
      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className={cn(inputs.label, "flex-1")}>
          Nombre o dirección
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. Art Institute, café en Wacker, Target..."
            className={inputs.base}
            disabled={isBusy}
          />
        </label>
        <Button type="submit" loading={isSearching} disabled={isBusy || query.trim().length < 2}>
          Buscar
        </Button>
      </form>

      {error ? (
        <ErrorMessage
          className="mt-4"
          message="No se pudo completar la búsqueda."
          technicalDetails={error}
        />
      ) : null}

      {duplicateMessage && pendingSelection ? (
        <div className={cn(surfaces.inset, "mt-4 space-y-3 p-4")}>
          <p className={typography.body}>{duplicateMessage}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                setPendingSelection(null);
                setDuplicateMessage(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" loading={isAdding} disabled={isBusy} onClick={handleConfirmDuplicate}>
              Agregar de todos modos
            </Button>
          </div>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {results.map((result) => (
            <li key={result.resultId}>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleSelect(result)}
                className={cn(
                  surfaces.inset,
                  "w-full px-4 py-3 text-left transition hover:border-blue-500/40 hover:bg-blue-950/20 disabled:opacity-60",
                )}
              >
                <p className={typography.placeName}>{result.name}</p>
                <p className={cn(typography.muted, "mt-1")}>{result.address}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
