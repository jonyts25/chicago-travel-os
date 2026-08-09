"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlaceToDayAction } from "@/app/planificar/actions";
import { PlaceDetailModal } from "@/components/planificar/place-detail-modal";
import { PlaceSearchPanel } from "@/components/planificar/place-search-panel";
import { PlaceSuggestionsPanel } from "@/components/planificar/place-suggestions-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { PlanningBoardData, PlanningDay } from "@/lib/itinerary/schema";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";
import { buttons, cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type PlacePool = "located" | "unlocated";

type UnplannedPlacesBoardProps = Pick<
  PlanningBoardData,
  "days" | "unplannedPlaces" | "unlocatedPlaces"
>;

export function UnplannedPlacesBoard({
  days,
  unplannedPlaces,
  unlocatedPlaces,
}: UnplannedPlacesBoardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [placePool, setPlacePool] = useState<PlacePool>("located");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const values = new Set<string>();
    for (const place of unplannedPlaces) {
      if (place.category) {
        values.add(place.category);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [unplannedPlaces]);

  const filteredUnplanned = useMemo(() => {
    if (categoryFilter === "all") {
      return unplannedPlaces;
    }
    return unplannedPlaces.filter((place) => place.category === categoryFilter);
  }, [categoryFilter, unplannedPlaces]);

  const visiblePlaces =
    placePool === "located" ? filteredUnplanned : unlocatedPlaces;

  function refreshPlaces() {
    router.refresh();
    showToast("Lista actualizada.");
  }

  function runAssign(placeId: string, dayId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await assignPlaceToDayAction(placeId, dayId);
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo agregar el lugar al día.");
        return;
      }
      showToast("Lugar agregado al día.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PlaceDetailModal
        placeId={selectedPlaceId}
        days={days.map((day) => ({ id: day.id, day_number: day.day_number }))}
        onClose={() => setSelectedPlaceId(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/planificar">
          <Button type="button" variant="secondary">
            Volver al itinerario
          </Button>
        </Link>
        <Button type="button" variant="secondary" disabled={isPending} onClick={refreshPlaces}>
          Refrescar
        </Button>
      </div>

      {actionError ? (
        <ErrorMessage
          message="No se pudo completar la acción. Intenta de nuevo."
          technicalDetails={actionError}
        />
      ) : null}

      <PlaceSearchPanel disabled={isPending} onPlaceAdded={() => router.refresh()} />

      <PlaceSuggestionsPanel />

      <Card
        title={placePool === "located" ? "Sin planear" : "Sin coordenadas"}
        subtitle={
          placePool === "located"
            ? `${unplannedPlaces.length} lugar(es) con coordenadas disponibles`
            : `${unlocatedPlaces.length} lugar(es) por reconciliar — abre el detalle para reintentar geocoding o editar.`
        }
      >
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bandejas de lugares">
            <PoolTabButton
              active={placePool === "located"}
              onClick={() => setPlacePool("located")}
              label="Sin planear"
              count={unplannedPlaces.length}
            />
            <PoolTabButton
              active={placePool === "unlocated"}
              onClick={() => setPlacePool("unlocated")}
              label="Sin coordenadas"
              count={unlocatedPlaces.length}
            />
          </div>

          {placePool === "located" ? (
            <label className={cn(inputs.label, "sm:max-w-xs")}>
              Categoría
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={inputs.base}
              >
                <option value="all">Todas</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {visiblePlaces.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={
              placePool === "located"
                ? "Sin lugares sin planear"
                : "Sin lugares pendientes de coordenadas"
            }
            description={
              placePool === "located"
                ? categoryFilter !== "all"
                  ? "No hay lugares sin planear en esta categoría."
                  : "Todos los lugares con coordenadas ya están asignados a un día, o aún no agregaste ninguno."
                : "Todos los lugares sin planear tienen coordenadas."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {visiblePlaces.map((place) => (
              <UnplannedPlaceCard
                key={place.id}
                place={place}
                days={days}
                disabled={isPending || placePool === "unlocated"}
                onOpen={() => setSelectedPlaceId(place.id)}
                onAssign={(dayId) => runAssign(place.id, dayId)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PoolTabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        buttons.base,
        "px-4",
        active ? buttons.primary : buttons.secondary,
      )}
    >
      {label}
      <span className={cn(typography.muted, "ml-2 font-normal")}>({count})</span>
    </button>
  );
}

function PlaceOpenButton({
  name,
  onOpen,
}: {
  name: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        typography.placeName,
        "text-left underline decoration-blue-500/50 underline-offset-2 hover:text-blue-200",
      )}
    >
      {name}
    </button>
  );
}

function UnplannedPlaceCard({
  place,
  days,
  disabled,
  onOpen,
  onAssign,
}: {
  place: PlanningBoardData["unplannedPlaces"][number];
  days: PlanningDay[];
  disabled: boolean;
  onOpen: () => void;
  onAssign: (dayId: string) => void;
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? "");

  return (
    <li className={cn(surfaces.inset, "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PlaceOpenButton name={place.name} onOpen={onOpen} />
          <p className={cn(typography.placeMeta, "mt-1")}>
            {formatCategory(place.category)} · {formatDurationMinutes(place.duration_minutes)}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
          <label className={inputs.label}>
            Día
            <select
              value={selectedDayId}
              onChange={(event) => setSelectedDayId(event.target.value)}
              className={inputs.base}
              disabled={disabled}
            >
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  Día {day.day_number}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={disabled || !selectedDayId}
            loading={disabled}
            onClick={() => onAssign(selectedDayId)}
          >
            Agregar al día
          </Button>
        </div>
      </div>
    </li>
  );
}
