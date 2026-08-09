"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSelectedPlaceSuggestionsAction,
  suggestPlacesAction,
} from "@/app/planificar/suggestion-actions";
import type { PlaceSuggestion } from "@/lib/ai/suggest-places";

export function PlaceSuggestionsPanel() {
  const router = useRouter();
  const [isSuggesting, startSuggesting] = useTransition();
  const [isAdding, startAdding] = useTransition();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
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
    setResultMessage(null);

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
    setResultMessage(null);

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

      setResultMessage(parts.join(" · "));
      if (result.errors.length > 0) {
        setError(result.errors.join(" "));
      }

      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Sugerencias con IA</h2>
          <p className="mt-1 text-sm text-slate-400">
            Propone lugares según las preferencias de ambos viajeros, el hotel y lo que ya tenéis
            en la lista. Son ideas generadas por IA — revísalas antes de agregar.
          </p>
        </div>
        <button
          type="button"
          disabled={isSuggesting || isAdding}
          onClick={handleSuggest}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSuggesting ? "Generando..." : "Sugerir lugares"}
        </button>
      </div>

      <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
        Estas sugerencias son generadas por IA y pueden no ser exactas. No están verificadas —
        elige solo las que quieras y se geocodificarán con Nominatim antes de entrar a la lista.
      </p>

      {contextSummary ? (
        <p className="mt-3 text-xs text-slate-500">
          Contexto usado: {contextSummary.travelerCount} viajero(s) ·{" "}
          {contextSummary.existingPlaceCount} lugar(es) ya en la lista · hotel/base:{" "}
          {contextSummary.baseLocation || "sin indicar"}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {resultMessage ? (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {resultMessage}
        </p>
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
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(key)}
                      className="mt-1 rounded border-slate-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {suggestion.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-400">
                        {suggestion.reason}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            disabled={isAdding || selectedKeys.size === 0}
            onClick={handleAddSelected}
            className="self-start rounded-lg border border-violet-400/40 bg-violet-900/40 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAdding ? "Agregando..." : `Agregar seleccionados (${selectedKeys.size})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
