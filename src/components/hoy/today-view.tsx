"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  loadTodayDayAction,
  updateTodayBlockStatusAction,
} from "@/app/hoy/actions";
import { ArrivalBanner } from "@/components/hoy/arrival-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import {
  getStoredActiveDay,
  setStoredActiveDay,
} from "@/lib/hoy/active-day-storage";
import {
  buildAlternativesMapUrl,
  buildMapsNavigationUrl,
  getCountdownLabel,
} from "@/lib/hoy/countdown";
import {
  getPendingBlocks,
  ITINERARY_ITEM_STATUS_DONE,
  ITINERARY_ITEM_STATUS_SKIPPED,
  type TodayBlock,
  type TodayDayData,
  type TodayPageContext,
} from "@/lib/hoy/today-types";
import { useArrivalGeolocation } from "@/lib/hoy/use-arrival-geolocation";
import { formatScheduleTime } from "@/lib/itinerary/schedule-day";
import { formatCategory } from "@/lib/planning/format";
import { TRIP_DAY_COUNT } from "@/lib/constants";
import { getDayTravelReminder } from "@/lib/trips/travel-info";
import { buttons, cn, surfaces, typography } from "@/lib/ui/styles";

type TodayViewProps = {
  context: TodayPageContext;
};

export function TodayView({ context }: TodayViewProps) {
  const { showToast } = useToast();
  const isManualDayMode = context.autoDayNumber == null;
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    if (context.autoDayNumber != null) {
      return context.autoDayNumber;
    }
    return getStoredActiveDay() ?? 1;
  });
  const [dayData, setDayData] = useState<TodayDayData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [dismissedArrivalBlockId, setDismissedArrivalBlockId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [isLoadingDay, startLoadDay] = useTransition();
  const [isUpdating, startUpdate] = useTransition();

  const activeDay = context.autoDayNumber ?? selectedDay;
  const dayReminder = getDayTravelReminder(activeDay, context.tripSettings);

  const loadDay = useCallback((dayNumber: number) => {
    startLoadDay(async () => {
      setLoadError(null);
      const result = await loadTodayDayAction(dayNumber);
      if (!result.ok) {
        setDayData(null);
        setLoadError(result.error);
        return;
      }
      setDayData(result.data);
    });
  }, []);

  useEffect(() => {
    if (isManualDayMode) {
      setStoredActiveDay(selectedDay);
    }
  }, [isManualDayMode, selectedDay]);

  useEffect(() => {
    loadDay(activeDay);
  }, [activeDay, loadDay]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const pendingBlocks = useMemo(
    () => (dayData ? getPendingBlocks(dayData.blocks) : []),
    [dayData],
  );

  const nextBlock = pendingBlocks[0] ?? null;
  const upcomingBlocks = pendingBlocks.slice(1);
  const isDayComplete = dayData != null && pendingBlocks.length === 0 && dayData.blocks.length > 0;
  const isDayEmpty = dayData != null && dayData.blocks.length === 0;

  const {
    permission: geoPermission,
    distanceMeters,
    isNearby,
    isSimulated,
    errorMessage: geoErrorMessage,
  } = useArrivalGeolocation({
    targetLat: nextBlock?.place.lat ?? null,
    targetLng: nextBlock?.place.lng ?? null,
    enabled: nextBlock != null && !isDayComplete,
  });

  useEffect(() => {
    setDismissedArrivalBlockId(null);
  }, [nextBlock?.id]);

  const showArrivalBanner =
    nextBlock != null &&
    isNearby &&
    dismissedArrivalBlockId !== nextBlock.id;

  const handleSelectDay = (dayNumber: number) => {
    setShowDaySummary(false);
    setActionError(null);
    setSelectedDay(dayNumber);
  };

  const handleStatusUpdate = (
    blockId: string,
    status: typeof ITINERARY_ITEM_STATUS_DONE | typeof ITINERARY_ITEM_STATUS_SKIPPED,
  ) => {
    if (!dayData) {
      return;
    }

    setActionError(null);

    const optimisticBlocks = dayData.blocks.map((block) =>
      block.id === blockId ? { ...block, status } : block,
    );
    setDayData({ ...dayData, blocks: optimisticBlocks });

    startUpdate(async () => {
      const result = await updateTodayBlockStatusAction(blockId, status);
      if (!result.ok) {
        setActionError(result.error);
        loadDay(activeDay);
        return;
      }
      showToast(
        status === ITINERARY_ITEM_STATUS_DONE
          ? "Bloque marcado como hecho."
          : "Bloque saltado.",
      );
      setDayData(result.data);
    });
  };

  const goToNextDay = () => {
    if (activeDay >= TRIP_DAY_COUNT) {
      return;
    }
    handleSelectDay(activeDay + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="!p-4">
        {isManualDayMode ? (
          <>
            <p className={typography.body}>Estoy en el</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: TRIP_DAY_COUNT }, (_, index) => {
                const dayNumber = index + 1;
                const isActive = selectedDay === dayNumber;
                return (
                  <button
                    key={dayNumber}
                    type="button"
                    onClick={() => handleSelectDay(dayNumber)}
                    className={cn(
                      buttons.base,
                      "px-2 text-base",
                      isActive ? buttons.primary : buttons.secondary,
                    )}
                  >
                    Día {dayNumber}
                  </button>
                );
              })}
            </div>
            <p className={cn(typography.muted, "mt-3")}>
              Sin fecha de inicio del viaje — recordamos tu selección en este dispositivo.
            </p>
          </>
        ) : (
          <p className={typography.sectionTitle}>Día {activeDay} de {TRIP_DAY_COUNT}</p>
        )}
      </Card>

      {dayReminder ? (
        <Card
          tone={activeDay === TRIP_DAY_COUNT ? "warning" : "default"}
          className="!py-4"
        >
          <p className={typography.body}>{dayReminder}</p>
        </Card>
      ) : null}

      {loadError ? (
        <ErrorMessage
          message="No se pudo cargar el día. Intenta de nuevo."
          technicalDetails={loadError}
        />
      ) : null}

      {isLoadingDay && !dayData ? (
        <CardSkeleton />
      ) : null}

      {isDayEmpty ? (
        <EmptyState
          title="Sin bloques planificados"
          description="Este día no tiene lugares asignados. Arma el itinerario en planificación."
          action={
            <Link href="/planificar">
              <Button>Ir a planificar</Button>
            </Link>
          }
        />
      ) : null}

      {nextBlock && geoPermission === "denied" ? (
        <p className={cn(surfaces.inset, "px-4 py-3", typography.secondary)}>
          Ubicación desactivada — el modo hoy funciona igual, pero no podremos sugerirte cuándo
          llegaste a un lugar.
        </p>
      ) : null}

      {nextBlock && geoPermission === "unsupported" ? (
        <p className={cn(surfaces.inset, "px-4 py-3", typography.secondary)}>
          Este navegador no ofrece geolocalización. Usa los botones Hecho / Saltar manualmente.
        </p>
      ) : null}

      {nextBlock && geoErrorMessage ? (
        <Card tone="warning" className="!py-4">
          <p className={typography.body}>{geoErrorMessage}</p>
        </Card>
      ) : null}

      {nextBlock && isSimulated && distanceMeters != null ? (
        <p className={cn(surfaces.inset, "border-blue-500/20 bg-blue-950/20 px-4 py-3", typography.muted, "text-blue-200/90")}>
          Modo simulación activo — distancia al bloque: {distanceMeters} m
          {isNearby ? " (dentro del radio de llegada)" : ""}.
        </p>
      ) : null}

      {showArrivalBanner ? (
        <ArrivalBanner
          placeName={nextBlock.place.name}
          disabled={isUpdating}
          onConfirm={() => handleStatusUpdate(nextBlock.id, ITINERARY_ITEM_STATUS_DONE)}
          onDismiss={() => setDismissedArrivalBlockId(nextBlock.id)}
        />
      ) : null}

      {isDayComplete ? (
        <Card tone="success">
          <p className={typography.eyebrow}>Día completado</p>
          <h2 className={cn(typography.pageTitle, "mt-2 text-2xl sm:text-3xl")}>
            ¡Listo el día {activeDay}!
          </h2>
          <p className={cn(typography.body, "mt-2")}>
            No quedan bloques pendientes para hoy.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDaySummary((value) => !value)}
            >
              {showDaySummary ? "Ocultar resumen" : "Ver resumen del día"}
            </Button>
            {activeDay < TRIP_DAY_COUNT ? (
              <Button type="button" onClick={goToNextDay}>
                Pasar al día {activeDay + 1}
              </Button>
            ) : null}
          </div>
          {showDaySummary && dayData ? (
            <DaySummaryList blocks={dayData.blocks} className="mt-5" />
          ) : null}
        </Card>
      ) : null}

      {nextBlock ? (
        <section className={cn(surfaces.card, surfaces.cardPadding, "shadow-lg")}>
          <p className={typography.eyebrow}>Próximo bloque</p>
          <p className={cn(typography.placeName, "mt-3 text-2xl sm:text-3xl")}>
            {nextBlock.place.name}
          </p>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn(typography.placeTime, "text-2xl")}>
              {getCountdownLabel(nextBlock.start_time, now)}
            </span>
            {nextBlock.start_time ? (
              <span className={typography.secondary}>
                · {formatScheduleTime(nextBlock.start_time)}
              </span>
            ) : null}
          </div>
          <p className={cn(typography.placeMeta, "mt-2")}>
            {formatCategory(nextBlock.place.category)}
          </p>

          <a
            href={buildMapsNavigationUrl(nextBlock.place)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttons.base, buttons.primary, "mt-6 w-full text-base")}
          >
            Navegar
          </a>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="success"
              disabled={isUpdating}
              loading={isUpdating}
              onClick={() => handleStatusUpdate(nextBlock.id, ITINERARY_ITEM_STATUS_DONE)}
            >
              Hecho
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(nextBlock.id, ITINERARY_ITEM_STATUS_SKIPPED)}
            >
              Saltar
            </Button>
            <Link
              href={buildAlternativesMapUrl(nextBlock.place)}
              className={cn(buttons.base, buttons.secondary, "text-center")}
            >
              Alternativa cercana
            </Link>
          </div>

          {actionError ? (
            <ErrorMessage
              className="mt-3"
              message="No se pudo actualizar el bloque."
              technicalDetails={actionError}
            />
          ) : null}
        </section>
      ) : null}

      {nextBlock && upcomingBlocks.length > 0 ? (
        <Card title="Después en el día">
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
            {upcomingBlocks.map((block) => (
              <li
                key={block.id}
                className={cn(surfaces.inset, "flex items-baseline gap-3 px-3 py-2.5")}
              >
                <span className={cn(typography.placeTime, "shrink-0 text-sm")}>
                  {block.start_time ? formatScheduleTime(block.start_time) : "—"}
                </span>
                <span className={cn(typography.body, "truncate")}>{block.place.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!isDayComplete && dayData && dayData.blocks.length > 0 ? (
        <Card className="!p-4">
          <button
            type="button"
            onClick={() => setShowDaySummary((value) => !value)}
            className={cn(typography.secondary, "font-medium underline-offset-2 hover:text-slate-300 hover:underline")}
          >
            {showDaySummary ? "Ocultar todo el día" : "Ver todo el día"}
          </button>
          {showDaySummary ? (
            <DaySummaryList blocks={dayData.blocks} className="mt-3" />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function DaySummaryList({
  blocks,
  className = "",
}: {
  blocks: TodayBlock[];
  className?: string;
}) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {blocks.map((block) => (
        <li
          key={block.id}
          className={cn(surfaces.inset, "flex items-center gap-3 px-3 py-2.5")}
        >
          <StatusBadge status={block.status} />
          <span className={cn(typography.placeTime, "shrink-0 text-sm")}>
            {block.start_time ? formatScheduleTime(block.start_time) : "—"}
          </span>
          <span className={cn(typography.body, "truncate")}>{block.place.name}</span>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: TodayBlock["status"] }) {
  if (status === ITINERARY_ITEM_STATUS_DONE) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
        Hecho
      </span>
    );
  }

  if (status === ITINERARY_ITEM_STATUS_SKIPPED) {
    return (
      <span className="shrink-0 rounded-full bg-slate-600/40 px-2 py-0.5 text-xs font-medium text-slate-300">
        Saltado
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
      Pendiente
    </span>
  );
}
