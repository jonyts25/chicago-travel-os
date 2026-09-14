"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkUpdatePlacesClassificationAction } from "@/app/planificar/place-actions";
import {
  InterestChipGroup,
  PriorityChipGroup,
} from "@/components/places/place-priority-interest-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { PlaceClassificationRow } from "@/lib/places/load-places-classification-data";
import type { PlaceInterest, PlacePriority } from "@/lib/places/place-detail";
import { tripPaths } from "@/lib/trips/trip-paths";
import { formatCategory } from "@/lib/planning/format";
import { cn, surfaces, typography } from "@/lib/ui/styles";

type DraftRow = {
  priority: PlacePriority | "";
  interest: PlaceInterest | "";
};

type PlaceBulkClassifyBoardProps = {
  tripId: string;
  places: PlaceClassificationRow[];
};

export function PlaceBulkClassifyBoard({ tripId, places }: PlaceBulkClassifyBoardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(() =>
    Object.fromEntries(
      places.map((place) => [
        place.id,
        {
          priority: place.priority ?? "",
          interest: place.interest ?? "",
        },
      ]),
    ),
  );

  const changedCount = useMemo(() => {
    return places.filter((place) => {
      const draft = drafts[place.id];
      if (!draft) {
        return false;
      }
      return draft.priority !== (place.priority ?? "") || draft.interest !== (place.interest ?? "");
    }).length;
  }, [drafts, places]);

  const incompleteCount = useMemo(() => {
    return Object.values(drafts).filter((draft) => !draft.priority || !draft.interest).length;
  }, [drafts]);

  function updateDraft(
    placeId: string,
    patch: Partial<DraftRow>,
  ): void {
    setDrafts((current) => ({
      ...current,
      [placeId]: {
        ...current[placeId],
        ...patch,
      },
    }));
  }

  function handleSave() {
    setError(null);

    const updates = places
      .map((place) => {
        const draft = drafts[place.id];
        if (!draft?.priority || !draft.interest) {
          return null;
        }

        if (
          draft.priority === (place.priority ?? "") &&
          draft.interest === (place.interest ?? "")
        ) {
          return null;
        }

        return {
          placeId: place.id,
          priority: draft.priority,
          interest: draft.interest,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (updates.length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }

    startTransition(async () => {
      const result = await bulkUpdatePlacesClassificationAction(tripId, updates);
      if (!result.ok) {
        setError(result.error ?? "No se pudieron guardar los cambios.");
        return;
      }

      showToast(`${result.updated} lugar(es) actualizado(s).`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={tripPaths(tripId).planificarLugares}>
          <Button type="button" variant="secondary">
            Volver a lugares
          </Button>
        </Link>
        <Button
          type="button"
          disabled={isPending || changedCount === 0}
          loading={isPending}
          onClick={handleSave}
        >
          Guardar cambios{changedCount > 0 ? ` (${changedCount})` : ""}
        </Button>
      </div>

      <Card
        title="Reclasificar lugares"
        subtitle={`${places.length} lugar(es) en este viaje. Toca los chips para ajustar prioridad e interés sin abrir cada ficha.`}
      >
        {incompleteCount > 0 ? (
          <p className={cn(typography.secondary, "mt-3")}>
            {incompleteCount} lugar(es) aún sin prioridad o interés definidos — complétalos aquí.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4">
            <ErrorMessage message="No se pudieron guardar los cambios." technicalDetails={error} />
          </div>
        ) : null}

        <ul className="mt-4 flex flex-col gap-3">
          {places.map((place) => {
            const draft = drafts[place.id];

            return (
              <li key={place.id} className={cn(surfaces.inset, "p-4")}>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className={typography.placeName}>{place.name}</p>
                    <p className={cn(typography.placeMeta, "mt-1")}>
                      {formatCategory(place.category)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <p className={cn(typography.muted, "mb-2 uppercase tracking-wide")}>
                        Prioridad
                      </p>
                      <PriorityChipGroup
                        value={draft?.priority ?? ""}
                        onChange={(value) => updateDraft(place.id, { priority: value })}
                        size="compact"
                        disabled={isPending}
                      />
                    </div>

                    <div>
                      <p className={cn(typography.muted, "mb-2 uppercase tracking-wide")}>
                        Interés
                      </p>
                      <InterestChipGroup
                        value={draft?.interest ?? ""}
                        onChange={(value) => updateDraft(place.id, { interest: value })}
                        size="compact"
                        disabled={isPending}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
