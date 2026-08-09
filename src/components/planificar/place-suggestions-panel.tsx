"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSelectedPlaceSuggestionsAction,
  suggestPlacesAction,
} from "@/app/planificar/suggestion-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/error-message";
import { useToast } from "@/components/ui/toast-provider";
import type { PlaceSuggestion } from "@/lib/ai/suggest-places";
import { cn, surfaces, typography } from "@/lib/ui/styles";

export function PlaceSuggestionsPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isSuggesting, startSuggesting] = useTransition();
  const [isAdding, startAdding] = useTransition();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState<{
    baseLocation: string | null;
    travelerCount: number;
    existingPlaceCount: number;
  } | null>(null);

  function suggestionKey(suggestion: PlaceSuggestion): string {
    return suggestion.name.toLowerCase();
  }

  function handleSuggest() {
    setError(null);

    startSuggesting(async () => {
      const result = await suggestPlacesAction();
      if (!result.ok) {
        setSuggestions([]);
        setSelectedKeys(new Set());
        setContextSummary(null);
        setError(result.error);
        return;
      }

      setSuggestions(result.suggestions);
      setSelectedKeys(new Set(result.suggestions.map((item) => suggestionKey(item))));
      setContextSummary(result.contextSummary);
    });
  }

  function toggleSelection(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleAddSelected() {
    const selected = suggestions.filter((suggestion) =>
      selectedKeys.has(suggestionKey(suggestion)),
    );

    if (selected.length === 0) {
      setError("Marca al menos una sugerencia para agregar.");
      return;
    }

    setError(null);

    startAdding(async () => {
      const result = await addSelectedPlaceSuggestionsAction(selected);
      if (!result.ok) {
        setError(result.error ?? "No se pudieron agregar los lugares.");
        return;
      }

      const parts: string[] = [];
      if (result.added.length > 0) {
        parts.push(`${result.added.length} agregado(s) a la lista sin planear`);
      }
      if (result.failedGeocode.length > 0) {
        parts.push(
          `${result.failedGeocode.length} no se pudieron ubicar: ${result.failedGeocode.join(", ")}`,
        );
      }
      if (result.skippedDuplicate.length > 0) {
        parts.push(`${result.skippedDuplicate.length} ya estaban en la lista`);
      }

      if (parts.length > 0) {
        showToast(parts.join(" · "));
      }

      if (result.errors.length > 0) {
        setError(result.errors.join(" "));
      }

      router.refresh();
    });
  }

  return (
    <Card
      title="Sugerencias con IA"
      subtitle="Propone lugares según las preferencias de ambos viajeros, el hotel y lo que ya tenéis en la lista. Son ideas generadas por IA — revísalas antes de agregar."
    >
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={isSuggesting || isAdding}
          loading={isSuggesting}
          onClick={handleSuggest}
        >
          Sugerir lugares
        </Button>
      </div>

      <p className={cn(surfaces.inset, "mt-3 px-3 py-2", typography.muted, "text-amber-100/90")}>
        Estas sugerencias son generadas por IA y pueden no ser exactas. No están verificadas —
        elige solo las que quieras y se geocodificarán con Nominatim antes de entrar a la lista.
      </p>

      {contextSummary ? (
        <p className={cn(typography.muted, "mt-3")}>
          Contexto usado: {contextSummary.travelerCount} viajero(s) ·{" "}
          {contextSummary.existingPlaceCount} lugar(es) ya en la lista · hotel/base:{" "}
          {contextSummary.baseLocation || "sin indicar"}
        </p>
      ) : null}

      {error ? (
        <ErrorMessage
          className="mt-3"
          message="No se pudieron procesar las sugerencias."
          technicalDetails={error}
        />
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-4 flex flex-col gap-4">
          <ul className="space-y-2">
            {suggestions.map((suggestion) => {
              const key = suggestionKey(suggestion);
              const checked = selectedKeys.has(key);

              return (
                <li
                  key={key}
                  className={cn(surfaces.inset, "bg-slate-950/70 px-3 py-3")}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(key)}
                      className="mt-1 rounded border-slate-600"
                    />
                    <span className="min-w-0">
                      <span className={cn(typography.placeName, "block text-base")}>
                        {suggestion.name}
                      </span>
                      <span className={cn(typography.secondary, "mt-1 block")}>
                        {suggestion.reason}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <Button
            type="button"
            disabled={isAdding || selectedKeys.size === 0}
            loading={isAdding}
            onClick={handleAddSelected}
            className="self-start"
          >
            Agregar seleccionados ({selectedKeys.size})
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
