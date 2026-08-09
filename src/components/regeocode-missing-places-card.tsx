"use client";

import { useState } from "react";
import { regeocodeMissingPlacesAction } from "@/app/import/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import { typography } from "@/lib/ui/styles";
import type { RegeocodeMissingPlacesResult } from "@/lib/places/regeocode-missing-places";

export function RegeocodeMissingPlacesCard({
  tripId,
  missingCount,
}: {
  tripId: string;
  missingCount: number;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<RegeocodeMissingPlacesResult | null>(null);
  const [remainingCount, setRemainingCount] = useState(missingCount);

  if (remainingCount === 0 && !result) {
    return null;
  }

  async function handleRegeocode() {
    setStatus("loading");
    setResult(null);

    const summary = await regeocodeMissingPlacesAction(tripId);
    setResult(summary);
    setRemainingCount(summary.failed.length);
    setStatus("done");

    if (summary.resolved > 0) {
      showToast(
        `${summary.resolved} de ${summary.total} lugares geocodificados`,
      );
    } else if (summary.total === 0) {
      showToast("No hay lugares pendientes de geocodificar.");
    }
  }

  const pendingCount = remainingCount;

  return (
    <Card
      className="mt-6"
      title="Geocodificar pendientes"
      subtitle="Reintenta Nominatim sobre lugares del trip sin coordenadas (1 solicitud por segundo)."
    >
      <p className={typography.body}>
        {pendingCount === 1
          ? "Hay 1 lugar sin coordenadas."
          : `Hay ${pendingCount} lugares sin coordenadas.`}
      </p>

      <Button
        type="button"
        className="mt-4"
        loading={status === "loading"}
        disabled={status === "loading" || pendingCount === 0}
        onClick={handleRegeocode}
      >
        Geocodificar pendientes
      </Button>

      {result ? (
        <div className="mt-4 space-y-3">
          <p className={typography.secondary}>
            Resultado: {result.resolved} de {result.total} resueltos
            {result.failed.length > 0
              ? ` · ${result.failed.length} sin resultado`
              : ""}
            .
          </p>

          {result.failed.length > 0 ? (
            <p className={typography.muted}>
              Sin coordenadas: {result.failed.join(", ")}
            </p>
          ) : null}

          {result.errors.length > 0 ? (
            <div className="space-y-2">
              {result.errors.map((error) => (
                <ErrorMessage
                  key={error}
                  message="Algunos lugares no se pudieron geocodificar."
                  technicalDetails={error}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
