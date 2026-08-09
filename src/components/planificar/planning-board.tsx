"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignPlaceToDayAction,
  generateItineraryAction,
  moveItineraryItemAction,
  regenerateDayItineraryAction,
  removePlaceFromDayAction,
} from "@/app/planificar/actions";
import { PlaceDetailModal } from "@/components/planificar/place-detail-modal";
import { PlaceSuggestionsPanel } from "@/components/planificar/place-suggestions-panel";
import { DaySettingsEditor } from "@/components/planificar/day-settings-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { PlanningBoardData, PlanningDay } from "@/lib/itinerary/schema";
import type { OptimizerSummary } from "@/lib/itinerary/optimizer/types";
import {
  formatDayEndMinutes,
  formatDayEndSourceLabel,
  formatDayStartSourceLabel,
} from "@/lib/itinerary/day-constraints";
import { formatPlanningDayTabLabel } from "@/lib/trips/trip-calendar";
import { DEFAULT_DAY_START_MINUTES, formatScheduleTime } from "@/lib/itinerary/schedule-day";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";
import { buttons, cn, inputs, surfaces, typography } from "@/lib/ui/styles";

type PlanningBoardProps = PlanningBoardData;

export function PlanningBoard({
  days,
  unplannedPlaces,
  unlocatedPlaces,
  tripSettings,
  tripAnchorDate,
  tripAnchorSource,
}: PlanningBoardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [activeDayNumber, setActiveDayNumber] = useState(days[0]?.day_number ?? 1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [optimizerSummary, setOptimizerSummary] = useState<OptimizerSummary | null>(
    null,
  );
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

  const activeDay = days.find((day) => day.day_number === activeDayNumber) ?? days[0];

  function runAction(
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage?: string,
  ) {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      if (successMessage) {
        showToast(successMessage);
      }
      router.refresh();
    });
  }

  function runOptimizer(
    action: () => Promise<OptimizerSummary>,
    successMessage = "Itinerario generado correctamente.",
  ) {
    setActionError(null);
    setOptimizerSummary(null);
    startTransition(async () => {
      const result = await action();
      setOptimizerSummary(result);
      if (!result.ok) {
        setActionError(result.error ?? "No se pudo generar el itinerario.");
        return;
      }
      showToast(successMessage);
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

      {actionError ? (
        <ErrorMessage
          message="No se pudo completar la acción. Intenta de nuevo."
          technicalDetails={actionError}
        />
      ) : null}

      <Card
        title="Optimizador"
        subtitle="Distribuye lugares sin planear respetando enfoque por día, hora límite (manual, vuelo o 22:00) y ~20 min de traslado entre paradas."
      >
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={isPending}
            loading={isPending}
            onClick={() => runOptimizer(() => generateItineraryAction())}
          >
            Generar itinerario
          </Button>
        </div>

        {optimizerSummary ? (
          <OptimizerSummaryPanel summary={optimizerSummary} />
        ) : null}
      </Card>

      <PlaceSuggestionsPanel />

      {unlocatedPlaces.length > 0 ? (
        <Card
          tone="warning"
          title={`No se pudieron ubicar (${unlocatedPlaces.length})`}
          subtitle="Lugares sin coordenadas — quedan fuera del optimizador. Agrégalos manualmente o corrige sus coordenadas."
        >
          <ul className="mt-4 flex flex-col gap-2">
            {unlocatedPlaces.map((place) => (
              <li
                key={place.id}
                className={cn(surfaces.inset, "px-3 py-2.5")}
              >
                <PlaceOpenButton
                  name={place.name}
                  onOpen={() => setSelectedPlaceId(place.id)}
                />
                <span className={typography.placeMeta}>
                  {" "}
                  · {formatCategory(place.category)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card
        title="Sin planear"
        subtitle={`${unplannedPlaces.length} lugar(es) con coordenadas disponibles`}
      >
        <div className="mt-4 flex justify-end">
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
        </div>

        {filteredUnplanned.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Sin lugares sin planear"
            description={
              categoryFilter !== "all"
                ? "No hay lugares sin planear en esta categoría. Prueba otra categoría o importa más lugares."
                : "Todos los lugares con coordenadas ya están asignados a un día."
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {filteredUnplanned.map((place) => (
              <UnplannedPlaceCard
                key={place.id}
                place={place}
                days={days}
                disabled={isPending}
                onOpen={() => setSelectedPlaceId(place.id)}
                onAssign={(dayId) =>
                  runAction(
                    () => assignPlaceToDayAction(place.id, dayId),
                    "Lugar agregado al día.",
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Itinerario por día">
        {tripAnchorDate && tripAnchorSource ? (
          <p className={cn(typography.muted, "mt-1")}>
            Fechas calculadas desde {tripAnchorSource}.
          </p>
        ) : (
          <p className={cn(typography.muted, "mt-1")}>
            Captura `trips.start_date`, check-in o llegada del vuelo en Ajustes para ver fechas reales.
          </p>
        )}

        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Días del viaje"
        >
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={activeDay?.id === day.id}
              onClick={() => setActiveDayNumber(day.day_number)}
              className={cn(
                buttons.base,
                "shrink-0 px-4",
                activeDay?.id === day.id
                  ? buttons.primary
                  : buttons.secondary,
              )}
            >
              {formatPlanningDayTabLabel(
                day.day_number,
                day.focus,
                day.calendar_date_label,
              )}
              <span className={cn(typography.muted, "ml-2 font-normal")}>
                ({day.items.length})
              </span>
            </button>
          ))}
        </div>

        {activeDay ? (
          <>
            <DaySettingsEditor day={activeDay} disabled={isPending} />
            <DayPlanPanel
              day={activeDay}
              tripSettings={tripSettings}
              disabled={isPending}
            onOpenPlace={(placeId) => setSelectedPlaceId(placeId)}
            onMoveUp={(itemId) =>
              runAction(
                () => moveItineraryItemAction(itemId, "up"),
                "Orden actualizado.",
              )
            }
            onMoveDown={(itemId) =>
              runAction(
                () => moveItineraryItemAction(itemId, "down"),
                "Orden actualizado.",
              )
            }
            onRemove={(itemId) =>
              runAction(
                () => removePlaceFromDayAction(itemId),
                "Lugar quitado del día.",
              )
            }
            onRegenerateDay={() =>
              runOptimizer(
                () => regenerateDayItineraryAction(activeDay.id),
                "Día regenerado correctamente.",
              )
            }
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}

function OptimizerSummaryPanel({ summary }: { summary: OptimizerSummary }) {
  const totalAssigned = summary.assignedByDay.reduce(
    (sum, day) => sum + day.count,
    0,
  );

  if (!summary.ok) {
    return (
      <ErrorMessage
        className="mt-4"
        message="No se pudo generar el itinerario."
        technicalDetails={summary.error}
      />
    );
  }

  return (
    <div className={cn(surfaces.inset, "mt-4 p-4")}>
      <h3 className={typography.sectionTitle}>Itinerario generado</h3>

      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className={typography.secondary}>Asignados en total</dt>
          <dd className={cn(typography.body, "font-medium text-white")}>{totalAssigned}</dd>
        </div>
        {summary.assignedByDay.map((day) => (
          <div key={day.dayNumber}>
            <dt className={typography.secondary}>Día {day.dayNumber}</dt>
            <dd className={cn(typography.body, "font-medium text-white")}>
              {day.count} lugar(es)
            </dd>
          </div>
        ))}
        <div>
          <dt className={typography.secondary}>Sin asignar (tiempo)</dt>
          <dd className={cn(typography.body, "font-medium text-white")}>
            {summary.unassignedDueToTime}
          </dd>
        </div>
        <div>
          <dt className={typography.secondary}>Sin coordenadas</dt>
          <dd className={cn(typography.body, "font-medium text-white")}>
            {summary.withoutCoordinates}
          </dd>
        </div>
      </dl>

      {summary.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {summary.warnings.map((warning) => (
            <li key={warning} className={cn(typography.body, "text-amber-200")}>
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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

        <div className="flex flex-col gap-2 sm:min-w-[220px]">
          <select
            value={selectedDayId}
            onChange={(event) => setSelectedDayId(event.target.value)}
            disabled={disabled || days.length === 0}
            className={inputs.base}
          >
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                Día {day.day_number}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={disabled || !selectedDayId}
            onClick={() => onAssign(selectedDayId)}
          >
            Agregar al día
          </Button>
        </div>
      </div>
    </li>
  );
}

function DayPlanPanel({
  day,
  tripSettings,
  disabled,
  onOpenPlace,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRegenerateDay,
}: {
  day: PlanningDay;
  tripSettings: PlanningBoardData["tripSettings"];
  disabled: boolean;
  onOpenPlace: (placeId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onRegenerateDay: () => void;
}) {
  const totalMinutes = day.items.reduce(
    (sum, item) => sum + (item.place.duration_minutes ?? 0),
    0,
  );
  const dayEndMinutes = DEFAULT_DAY_START_MINUTES + day.day_active_minutes_limit;

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={typography.secondary}>
            {formatPlanningDayTabLabel(
              day.day_number,
              day.focus,
              day.calendar_date_label,
            )}
            {" · "}Duración estimada: {formatDurationMinutes(totalMinutes)}
          </p>
          <p className={cn(typography.muted, "mt-1")}>
            Inicio: {formatDayEndMinutes(day.day_start_minutes)} (
            {formatDayStartSourceLabel(day.day_start_source)}) · Hora límite:{" "}
            {formatDayEndMinutes(dayEndMinutes)} ({formatDayEndSourceLabel(day.day_end_source)})
            {day.day_end_source === "flight" && tripSettings.flight_departure
              ? ` · vuelo ${new Date(tripSettings.flight_departure).toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          loading={disabled}
          onClick={onRegenerateDay}
        >
          Regenerar solo este día
        </Button>
      </div>

      {day.items.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Día sin lugares"
          description="Aún no hay lugares asignados a este día. Agrega lugares desde la lista sin planear o usa el optimizador."
        />
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {day.items.map((item, index) => (
            <li key={item.id} className={cn(surfaces.inset, "p-4")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={typography.muted}>
                    #{index + 1}
                    {item.is_fixed ? " · Fijado" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {item.start_time ? (
                      <span className={typography.placeTime}>
                        {formatScheduleTime(item.start_time)}
                      </span>
                    ) : null}
                    <PlaceOpenButton
                      name={item.place.name}
                      onOpen={() => onOpenPlace(item.place.id)}
                    />
                  </div>
                  <p className={cn(typography.placeMeta, "mt-1")}>
                    {formatCategory(item.place.category)} ·{" "}
                    {formatDurationMinutes(item.place.duration_minutes)}
                    {item.end_time
                      ? ` · hasta ${formatScheduleTime(item.end_time)}`
                      : ""}
                  </p>
                </div>

                {item.is_fixed ? (
                  <p className={typography.muted}>Fijado — puedes editar el detalle, no reordenar</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled || index === 0}
                      onClick={() => onMoveUp(item.id)}
                    >
                      Subir
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled || index === day.items.length - 1}
                      onClick={() => onMoveDown(item.id)}
                    >
                      Bajar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={disabled}
                      onClick={() => onRemove(item.id)}
                    >
                      Quitar
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
