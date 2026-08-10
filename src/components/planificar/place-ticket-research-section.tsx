"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getPlaceTicketResearchAction,
  investigatePlaceTicketsAction,
} from "@/app/planificar/place-ticket-actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatTicketResearchSearchedAt,
  type PlaceTicketResearchRecord,
} from "@/lib/places/place-ticket-research";
import { cn, surfaces, typography } from "@/lib/ui/styles";

type PlaceTicketResearchSectionProps = {
  tripId: string;
  placeId: string;
  placeName: string;
  disabled?: boolean;
};

export function PlaceTicketResearchSection({
  tripId,
  placeId,
  placeName,
  disabled,
}: PlaceTicketResearchSectionProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isInvestigating, startInvestigating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState<PlaceTicketResearchRecord | null>(null);
  const [tripTimezone, setTripTimezone] = useState<string>("America/Chicago");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPlaceTicketResearchAction(tripId, placeId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setResearch(null);
        setError(result.error);
        setLoading(false);
        return;
      }

      setResearch(result.research);
      setTripTimezone(result.tripTimezone);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tripId, placeId]);

  function runInvestigation() {
    setError(null);
    startInvestigating(async () => {
      const result = await investigatePlaceTicketsAction(tripId, placeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setResearch(result.research);
      setTripTimezone(result.tripTimezone);
      showToast("Información de tickets actualizada.");
    });
  }

  if (loading) {
    return (
      <section className={cn(surfaces.inset, "p-4")}>
        <h3 className={typography.body}>Investigar tickets</h3>
        <Skeleton className="mt-3 h-20 w-full" />
      </section>
    );
  }

  return (
    <section className={cn(surfaces.inset, "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={typography.body}>Investigar tickets</h3>
          <p className={cn(typography.muted, "mt-1")}>
            Búsqueda web bajo demanda para {placeName}. Máx. 3 búsquedas por consulta.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={disabled || isInvestigating}
          loading={isInvestigating}
          onClick={runInvestigation}
          className="shrink-0"
        >
          {research ? "Actualizar" : "Investigar tickets"}
        </Button>
      </div>

      {research ? (
        <div className="mt-4 space-y-3">
          <p className={cn(typography.secondary, "text-xs")}>
            Consultado: {formatTicketResearchSearchedAt(research.searchedAt, tripTimezone)}
            {research.webSearchCount > 0
              ? ` · ${research.webSearchCount} búsqueda(s) web`
              : ""}
          </p>

          <div className={cn(surfaces.inset, "whitespace-pre-wrap bg-slate-950/60 px-3 py-3")}>
            <p className={cn(typography.body, "text-sm leading-relaxed")}>{research.summary}</p>
          </div>

          {research.sources.length > 0 ? (
            <div>
              <p className={cn(typography.eyebrow, "mb-2")}>Fuentes consultadas</p>
              <ul className="space-y-1">
                {research.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-300"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className={cn(typography.muted, "text-amber-100/90")}>
            Información generada con búsqueda web, puede no estar actualizada — verifica antes de
            comprar.
          </p>
        </div>
      ) : (
        <p className={cn(typography.muted, "mt-3")}>
          Aún no hay información guardada. Pulsa &quot;Investigar tickets&quot; para consultar con
          búsqueda web (tiene costo por uso).
        </p>
      )}

      {error ? (
        <ErrorMessage
          className="mt-3"
          message="No se pudo obtener información de tickets."
          technicalDetails={error}
        />
      ) : null}
    </section>
  );
}
