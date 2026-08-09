"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  loadTodayDayAction,
  updateTodayBlockStatusAction,
} from "@/app/hoy/actions";
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
import { formatScheduleTime } from "@/lib/itinerary/schedule-day";
import { formatCategory } from "@/lib/planning/format";
import { TRIP_DAY_COUNT } from "@/lib/constants";

type TodayViewProps = {
  context: TodayPageContext;
};

export function TodayView({ context }: TodayViewProps) {
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
  const [now, setNow] = useState(() => new Date());
  const [isLoadingDay, startLoadDay] = useTransition();
  const [isUpdating, startUpdate] = useTransition();

  const activeDay = context.autoDayNumber ?? selectedDay;

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
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        {isManualDayMode ? (
          <>
            <p className="text-sm font-medium text-slate-300">Estoy en el</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: TRIP_DAY_COUNT }, (_, index) => {
                const dayNumber = index + 1;
                const isActive = selectedDay === dayNumber;
                return (
                  <button
                    key={dayNumber}
                    type="button"
                    onClick={() => handleSelectDay(dayNumber)}
                    className={`rounded-xl px-2 py-3 text-base font-semibold transition ${
                      isActive
                        ? "bg-emerald-500 text-slate-950"
                        : "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    Día {dayNumber}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Sin fecha de inicio del viaje — recordamos tu selección en este dispositivo.
            </p>
          </>
        ) : (
          <p className="text-lg font-semibold text-white">
            Día {activeDay} de {TRIP_DAY_COUNT}
          </p>
        )}
      </section>

      {loadError ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-950/40 p-5">
          <p className="text-sm text-red-200">{loadError}</p>
        </section>
      ) : null}

      {isLoadingDay && !dayData ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center">
          <p className="text-base text-slate-400">Cargando el día…</p>
        </section>
      ) : null}

      {isDayEmpty ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6">
          <h2 className="text-xl font-semibold text-amber-100">Sin bloques planificados</h2>
          <p className="mt-2 text-sm text-amber-200/90">
            Este día no tiene lugares asignados. Arma el itinerario en planificación.
          </p>
          <Link
            href="/planificar"
            className="mt-4 inline-flex rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            Ir a planificar
          </Link>
        </section>
      ) : null}

      {isDayComplete ? (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-300">
            Día completado
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            ¡Listo el día {activeDay}!
          </h2>
          <p className="mt-2 text-base text-emerald-100/90">
            No quedan bloques pendientes para hoy.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowDaySummary((value) => !value)}
              className="rounded-xl border border-emerald-400/40 bg-emerald-900/40 px-4 py-3 text-base font-semibold text-emerald-100"
            >
              {showDaySummary ? "Ocultar resumen" : "Ver resumen del día"}
            </button>
            {activeDay < TRIP_DAY_COUNT ? (
              <button
                type="button"
                onClick={goToNextDay}
                className="rounded-xl bg-emerald-500 px-4 py-3 text-base font-semibold text-slate-950"
              >
                Pasar al día {activeDay + 1}
              </button>
            ) : null}
          </div>
          {showDaySummary && dayData ? (
            <DaySummaryList blocks={dayData.blocks} className="mt-5" />
          ) : null}
        </section>
      ) : null}

      {nextBlock ? (
        <section className="rounded-3xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-lg">
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-emerald-400">
            Próximo bloque
          </p>
          <p className="mt-3 text-4xl font-bold leading-tight text-white">
            {nextBlock.place.name}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-emerald-300">
              {getCountdownLabel(nextBlock.start_time, now)}
            </span>
            {nextBlock.start_time ? (
              <span className="text-lg text-slate-400">
                · {formatScheduleTime(nextBlock.start_time)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-base text-slate-400">
            {formatCategory(nextBlock.place.category)}
          </p>

          <a
            href={buildMapsNavigationUrl(nextBlock.place)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-blue-500 px-4 py-4 text-lg font-semibold text-white transition hover:bg-blue-400"
          >
            Navegar
          </a>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(nextBlock.id, ITINERARY_ITEM_STATUS_DONE)}
              className="rounded-2xl bg-emerald-600 px-3 py-4 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              Hecho
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusUpdate(nextBlock.id, ITINERARY_ITEM_STATUS_SKIPPED)}
              className="rounded-2xl border border-slate-600 bg-slate-900 px-3 py-4 text-base font-semibold text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
            >
              Saltar
            </button>
            <Link
              href={buildAlternativesMapUrl(nextBlock.place)}
              className="flex items-center justify-center rounded-2xl border border-amber-500/50 bg-amber-950/40 px-3 py-4 text-center text-base font-semibold text-amber-100 transition hover:border-amber-400"
            >
              Alternativa cercana
            </Link>
          </div>

          {actionError ? (
            <p className="mt-3 text-sm text-red-300">{actionError}</p>
          ) : null}
        </section>
      ) : null}

      {nextBlock && upcomingBlocks.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Después en el día
          </h2>
          <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
            {upcomingBlocks.map((block) => (
              <li
                key={block.id}
                className="flex items-baseline gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3 py-2.5"
              >
                <span className="shrink-0 text-sm font-medium tabular-nums text-slate-400">
                  {block.start_time ? formatScheduleTime(block.start_time) : "—"}
                </span>
                <span className="truncate text-base text-slate-200">{block.place.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isDayComplete && dayData && dayData.blocks.length > 0 ? (
        <section className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-4">
          <button
            type="button"
            onClick={() => setShowDaySummary((value) => !value)}
            className="text-sm font-medium text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            {showDaySummary ? "Ocultar todo el día" : "Ver todo el día"}
          </button>
          {showDaySummary ? (
            <DaySummaryList blocks={dayData.blocks} className="mt-3" />
          ) : null}
        </section>
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
          className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
        >
          <StatusBadge status={block.status} />
          <span className="shrink-0 text-sm tabular-nums text-slate-400">
            {block.start_time ? formatScheduleTime(block.start_time) : "—"}
          </span>
          <span className="truncate text-sm text-slate-200">{block.place.name}</span>
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
