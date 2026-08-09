"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateItineraryAction,
  moveItineraryItemAction,
  regenerateDayItineraryAction,
  removePlaceFromDayAction,
  clearDayAction,
} from "@/app/planificar/actions";
import { PlaceDetailModal } from "@/components/planificar/place-detail-modal";
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
import {
  formatFlightDepartureCutoffTime,
  formatFlightDepartureDateTime,
  formatFlightDepartureTime,
} from "@/lib/trips/travel-info";
import { formatScheduleTime } from "@/lib/itinerary/schedule-day";
import { formatCategory, formatDurationMinutes } from "@/lib/planning/format";
import { buttons, cn, surfaces, typography } from "@/lib/ui/styles";

type PlanningBoardProps = Pick<
  PlanningBoardData,
  "days" | "tripSettings" | "tripAnchorDate" | "tripAnchorSource"
>;

export function PlanningBoard({
  days,
  tripSettings,
  tripAnchorDate,
  tripAnchorSource,
}: PlanningBoardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [activeDayNumber, setActiveDayNumber] = useState(days[0]?.day_number ?? 1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [optimizerSummary, setOptimizerSummary] = useState<OptimizerSummary | null>(
    null,
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

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

      <div className="flex justify-end">
        <Link href="/planificar/lugares">
          <Button type="button" variant="secondary">
            Agregar lugares
          </Button>
        </Link>
      </div>

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
            onClearDay={() => {
              const removableCount = activeDay.items.filter((item) => !item.is_fixed).length;
              const fixedCount = activeDay.items.length - removableCount;

              if (removableCount === 0) {
                showToast(
                  fixedCount > 0
                    ? "No hay lugares quitables — los fijados se conservan."
                    : "Este día ya está vacío.",
                );
                return;
              }

              const fixedNote =
                fixedCount > 0
                  ? `\n\nSe conservarán ${fixedCount} lugar(es) fijado(s).`
                  : "";
              const confirmed = window.confirm(
                `¿Vaciar el Día ${activeDay.day_number}? Se quitarán ${removableCount} lugar(es) y volverán a "sin planear".${fixedNote}\n\nEsta acción no se puede deshacer.`,
              );

              if (!confirmed) {
                return;
              }

              runAction(
                () => clearDayAction(activeDay.id),
                `Día ${activeDay.day_number} vaciado.`,
              );
            }}
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

function DayPlanPanel({
  day,
  tripSettings,
  disabled,
  onOpenPlace,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRegenerateDay,
  onClearDay,
}: {
  day: PlanningDay;
  tripSettings: PlanningBoardData["tripSettings"];
  disabled: boolean;
  onOpenPlace: (placeId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onRegenerateDay: () => void;
  onClearDay: () => void;
}) {
  const totalMinutes = day.items.reduce(
    (sum, item) => sum + (item.place.duration_minutes ?? 0),
    0,
  );
  const flightDepartureTimeLabel = formatFlightDepartureTime(
    tripSettings.flight_departure,
    tripSettings.timezone,
  );
  const flightDepartureDateTimeLabel = formatFlightDepartureDateTime(
    tripSettings.flight_departure,
    tripSettings.timezone,
  );
  const flightCutoffTimeLabel =
    day.day_end_source === "flight"
      ? formatFlightDepartureCutoffTime(
          tripSettings.flight_departure,
          tripSettings.airport_transfer_minutes,
          tripSettings.timezone,
        )
      : null;
  const displayedDayEndLabel =
    flightCutoffTimeLabel ?? formatDayEndMinutes(day.day_end_minutes);

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
            {displayedDayEndLabel} ({formatDayEndSourceLabel(day.day_end_source)})
            {day.day_end_source === "flight" && flightDepartureDateTimeLabel
              ? ` · vuelo ${flightDepartureDateTimeLabel}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            disabled={disabled}
            loading={disabled}
            onClick={onClearDay}
          >
            Vaciar día
          </Button>
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
      </div>

      {day.day_end_source === "flight" && tripSettings.flight_departure ? (
        <div
          className={cn(
            surfaces.inset,
            "mt-4 border border-amber-500/20 bg-amber-950/20 p-4",
          )}
        >
          <p className={typography.sectionTitle}>Traslado al aeropuerto</p>
          <p className={cn(typography.body, "mt-2")}>
            Última actividad antes de las{" "}
            <span className="font-medium text-white">{displayedDayEndLabel}</span>
            {flightDepartureTimeLabel
              ? ` para el vuelo de regreso a las ${flightDepartureTimeLabel}`
              : ""}
            {" "}
            (margen de {tripSettings.airport_transfer_minutes} min al aeropuerto).
          </p>
        </div>
      ) : null}

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
