"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverPlacesAction,
  saveDiscoverPlaceAction,
} from "@/app/discover/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { DiscoverSuggestion } from "@/lib/ai/discover-places";
import {
  formatDistanceMeters,
  useLiveGeolocation,
  type LocationSource,
} from "@/lib/hoy/use-live-geolocation";
import { formatCategory } from "@/lib/planning/format";
import { cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type DiscoverViewProps = {
  tripId: string;
  tripCity: string | null;
  tripCenter: { lat: number; lng: number } | null;
};

export function DiscoverView({ tripId, tripCity, tripCenter }: DiscoverViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([]);
  const [poiCount, setPoiCount] = useState<number | null>(null);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [serverLocationSource, setServerLocationSource] = useState<
    "device" | "trip_center" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fallbackCenter = useMemo(
    () => tripCenter,
    [tripCenter?.lat, tripCenter?.lng],
  );

  const {
    permission,
    position,
    locationSource,
    isSimulated,
    errorMessage,
    requestPermission,
  } = useLiveGeolocation({
    enabled: true,
    fallbackCenter,
    includeStoredSimulation: false,
  });

  function handleSearch() {
    if (!position) {
      setError(
        tripCenter
          ? "Necesitamos tu ubicación o el centro del viaje para buscar lugares cercanos."
          : "Necesitamos tu ubicación para buscar lugares cercanos.",
      );
      return;
    }

    setError(null);
    startSearching(async () => {
      const result = await discoverPlacesAction(tripId, {
        lat: position.lat,
        lng: position.lng,
        query,
      });

      if (!result.ok) {
        setSuggestions([]);
        setPoiCount(null);
        setSearchCoords(null);
        setServerLocationSource(null);
        setError(result.error);
        return;
      }

      setSuggestions(result.suggestions);
      setPoiCount(result.poiCount);
      setSearchCoords({ lat: result.searchLat, lng: result.searchLng });
      setServerLocationSource(result.locationSource);
    });
  }

  function handleSave(suggestion: DiscoverSuggestion, forceDuplicate = false) {
    setSavingKey(suggestion.osmId);
    setError(null);

    saveDiscoverPlaceAction(tripId, suggestion, { forceDuplicate }).then((result) => {
      setSavingKey(null);

      if (!result.ok) {
        if (result.needsConfirmation && result.duplicateName) {
          const confirmed = window.confirm(
            `Ya existe "${result.duplicateName}" muy cerca. ¿Agregar "${suggestion.name}" de todos modos?`,
          );
          if (confirmed) {
            handleSave(suggestion, true);
          }
          return;
        }

        setError(result.error);
        return;
      }

      showToast(`"${result.name}" guardado en la lista sin planear.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Descubrir cerca de ti"
        subtitle="Usamos tu ubicación en vivo (o el centro del viaje como respaldo), lugares reales de OpenStreetMap y vuestras preferencias."
      >
        <LocationStatus
          permission={permission}
          position={position}
          locationSource={locationSource}
          tripCity={tripCity}
          tripCenter={tripCenter}
          isSimulated={isSimulated}
          errorMessage={errorMessage}
          onRequestPermission={requestPermission}
        />

        <label className={cn(inputs.label, "mt-4 block")}>
          ¿Qué buscas? (opcional)
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Ej. "tenemos hambre", "algo tranquilo para la tarde"'
            className={inputs.base}
            disabled={isSearching}
          />
        </label>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={isSearching || !position}
            loading={isSearching}
            onClick={handleSearch}
          >
            Buscar sugerencias
          </Button>
        </div>

        <p className={cn(surfaces.inset, "mt-3 px-3 py-2", typography.muted, "text-amber-100/90")}>
          Las sugerencias combinan POIs reales de OpenStreetMap con ranking de IA según tu pregunta
          y las preferencias del viaje. Revísalas antes de guardar.
        </p>

        {searchCoords ? (
          <p className={cn(typography.muted, "mt-3")}>
            Búsqueda en {searchCoords.lat.toFixed(5)}, {searchCoords.lng.toFixed(5)}
            {serverLocationSource === "trip_center"
              ? ` · usando centro del viaje${tripCity ? ` (${tripCity})` : ""}`
              : " · usando ubicación del dispositivo"}
            {poiCount != null ? ` · ${poiCount} POI(s) en OpenStreetMap` : ""}
          </p>
        ) : poiCount != null ? (
          <p className={cn(typography.muted, "mt-3")}>
            Analizamos {poiCount} lugar(es) cercanos en OpenStreetMap.
          </p>
        ) : null}

        {error ? (
          <ErrorMessage
            className="mt-3"
            message="No se pudieron obtener sugerencias."
            technicalDetails={error}
          />
        ) : null}
      </Card>

      {suggestions.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion.osmId} className={cn(surfaces.inset, "p-4")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={typography.placeName}>{suggestion.name}</p>
                  <p className={cn(typography.placeMeta, "mt-1")}>
                    {formatCategory(suggestion.category)} ·{" "}
                    {formatDistanceMeters(suggestion.distanceMeters)}
                  </p>
                  <p className={cn(typography.secondary, "mt-2")}>{suggestion.reason}</p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={savingKey != null}
                  loading={savingKey === suggestion.osmId}
                  onClick={() => handleSave(suggestion)}
                >
                  Guardar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LocationStatus({
  permission,
  position,
  locationSource,
  tripCity,
  tripCenter,
  isSimulated,
  errorMessage,
  onRequestPermission,
}: {
  permission: string;
  position: { lat: number; lng: number } | null;
  locationSource: LocationSource | null;
  tripCity: string | null;
  tripCenter: { lat: number; lng: number } | null;
  isSimulated: boolean;
  errorMessage: string | null;
  onRequestPermission: () => void;
}) {
  if (permission === "unsupported") {
    return (
      <ErrorMessage
        message="Geolocalización no disponible."
        technicalDetails={
          tripCenter
            ? `Usaremos el centro del viaje${tripCity ? ` (${tripCity})` : ""} como respaldo.`
            : "Tu navegador no soporta geolocalización."
        }
      />
    );
  }

  if (permission === "denied" && !position) {
    return (
      <div className={cn(surfaces.inset, "px-3 py-3")}>
        <p className={typography.body}>Permiso de ubicación denegado.</p>
        <p className={cn(typography.muted, "mt-1")}>
          {tripCenter
            ? `Activa la ubicación en el navegador o usa el centro del viaje${tripCity ? ` (${tripCity})` : ""} cuando esté disponible.`
            : "Activa la ubicación para este sitio en ajustes del navegador y vuelve a intentar."}
        </p>
      </div>
    );
  }

  if (permission === "requesting" && !position) {
    return (
      <div className={cn(surfaces.inset, "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between")}>
        <p className={typography.secondary}>
          Necesitamos tu ubicación en vivo para sugerir lugares cercanos
          {tripCenter ? ` (o usaremos el centro del viaje${tripCity ? `: ${tripCity}` : ""})` : ""}.
        </p>
        <Button type="button" variant="secondary" onClick={onRequestPermission}>
          Permitir ubicación
        </Button>
      </div>
    );
  }

  if (position) {
    const sourceLabel =
      locationSource === "trip_center"
        ? `centro del viaje${tripCity ? ` (${tripCity})` : ""}`
        : locationSource === "simulated"
          ? "simulada (URL)"
          : "dispositivo";

    return (
      <p className={cn(typography.secondary, surfaces.inset, "px-3 py-2")}>
        Ubicación activa: {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · {sourceLabel}
        {isSimulated ? " · simulada" : ""}
        {errorMessage ? ` · ${errorMessage}` : ""}
      </p>
    );
  }

  return (
    <div className={cn(surfaces.inset, "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between")}>
      <p className={typography.secondary}>Esperando tu ubicación...</p>
      <Button type="button" variant="secondary" onClick={onRequestPermission}>
        Permitir ubicación
      </Button>
    </div>
  );
}
