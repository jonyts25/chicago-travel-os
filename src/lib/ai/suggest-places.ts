import { callAI, isAnthropicConfigured } from "@/lib/ai/call-ai";
import type { SuggestionContext } from "@/lib/users/schema";

export type PlaceSuggestion = {
  name: string;
  reason: string;
};

const SYSTEM_PROMPT = `Eres un asistente de viajes para Chicago, Illinois.
Responde SOLO con JSON válido, sin markdown ni texto extra.
Devuelve un array JSON de 5 a 8 objetos con:
- name: nombre real del lugar en Chicago (negocio, museo, barrio, parque, etc.)
- reason: una frase breve en español explicando por qué encaja con las preferencias

Reglas:
- Solo lugares plausibles en el área metropolitana de Chicago.
- No repitas lugares que ya estén en la lista existente del usuario.
- Prioriza opciones razonablemente cercanas al hotel/base si se indica.
- Evita cadenas genéricas sin ancla local cuando haya alternativas mejores.
- Los nombres deben ser buscables en un mapa (nombre oficial o muy conocido).`;

export async function generatePlaceSuggestions(
  context: SuggestionContext,
): Promise<{ suggestions: PlaceSuggestion[]; error: string | null }> {
  if (!isAnthropicConfigured()) {
    return {
      suggestions: [],
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  const travelerLines = context.travelers.map((traveler) => {
    const text = traveler.preferences?.trim() || "(sin preferencias escritas)";
    return `- ${traveler.label}: ${text}`;
  });

  const existingLines =
    context.existingPlaceNames.length > 0
      ? context.existingPlaceNames.slice(0, 120).join("\n")
      : "(ninguno todavía)";

  const userPrompt = [
    "Genera sugerencias de lugares para este viaje.",
    "",
    `Hotel / base del viaje: ${context.baseLocation || "(no indicado todavía)"}`,
    "",
    "Preferencias de los viajeros:",
    ...travelerLines,
    "",
    "Lugares que YA están en la lista (no sugerir de nuevo):",
    existingLines,
    "",
    "Devuelve entre 5 y 8 sugerencias nuevas en un array JSON.",
  ].join("\n");

  const { text, error } = await callAI(SYSTEM_PROMPT, userPrompt);

  if (error) {
    return { suggestions: [], error };
  }

  if (!text) {
    return { suggestions: [], error: "La IA no devolvió sugerencias." };
  }

  const suggestions = parseSuggestionResponse(text);
  if (suggestions.length === 0) {
    return {
      suggestions: [],
      error: "No se pudieron interpretar las sugerencias de la IA.",
    };
  }

  return { suggestions, error: null };
}

function parseSuggestionResponse(raw: string): PlaceSuggestion[] {
  const jsonText = extractJsonArray(raw);
  if (!jsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();

    return parsed
      .map((item) => normalizeSuggestionItem(item))
      .filter((item): item is PlaceSuggestion => {
        if (!item) {
          return false;
        }

        const key = item.name.toLowerCase();
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  } catch {
    return [];
  }
}

function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    return trimmed;
  }

  const match = trimmed.match(/\[[\s\S]*\]/);
  return match?.[0] ?? null;
}

function normalizeSuggestionItem(value: unknown): PlaceSuggestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (!name) {
    return null;
  }

  return {
    name,
    reason: reason || "Sugerido según vuestras preferencias.",
  };
}
