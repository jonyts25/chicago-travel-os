import { callAI, isAnthropicConfigured } from "@/lib/ai/call-ai";
import type { OverpassPoi } from "@/lib/overpass/query-nearby-pois";
import type { TripTravelerPreferences } from "@/lib/users/schema";

export type DiscoverSuggestion = {
  osmId: string;
  name: string;
  category: string;
  distanceMeters: number;
  lat: number;
  lng: number;
  reason: string;
};

const SYSTEM_PROMPT = `Eres un asistente de viajes que recomienda lugares REALES cercanos al usuario.
Responde SOLO con JSON válido, sin markdown ni texto extra.
Devuelve un array JSON de 5 a 8 objetos con:
- osmId: identificador OSM exacto de la lista (ej. "node/12345")
- reason: una frase breve en español explicando por qué encaja con la pregunta y las preferencias

Reglas:
- Solo elige lugares de la lista de POIs reales proporcionada.
- No inventes lugares ni cambies nombres.
- Prioriza relevancia a la pregunta/mood del usuario y las preferencias de los viajeros.
- Evita repetir el mismo tipo de lugar si hay opciones variadas.
- Si la pregunta está vacía, sugiere opciones variadas y bien valoradas cerca.`;

export async function rankNearbyPoisWithAI(input: {
  userQuery: string;
  tripCity: string | null;
  travelers: TripTravelerPreferences[];
  pois: OverpassPoi[];
}): Promise<{ suggestions: DiscoverSuggestion[]; error: string | null }> {
  if (!isAnthropicConfigured()) {
    return {
      suggestions: [],
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  if (input.pois.length === 0) {
    return { suggestions: [], error: "No hay POIs para rankear." };
  }

  const travelerLines = input.travelers.map((traveler) => {
    const text = traveler.preferences?.trim() || "(sin preferencias escritas)";
    return `- ${traveler.label}: ${text}`;
  });

  const poiLines = input.pois.map(
    (poi) =>
      `- osmId=${poi.osmId} | ${poi.name} | ${poi.category} | ${poi.distanceMeters} m`,
  );

  const moodLine = input.userQuery.trim()
    ? input.userQuery.trim()
    : "(sin pregunta — sugiere algo bueno cerca)";

  const cityLine = input.tripCity?.trim() || "el destino del viaje activo";

  const userPrompt = [
    "Rankea los POIs más relevantes para este momento.",
    "",
    `Viaje / ciudad activa: ${cityLine}`,
    `Pregunta / mood del usuario: ${moodLine}`,
    "",
    "Preferencias de los viajeros:",
    ...travelerLines,
    "",
    "POIs reales cercanos (OpenStreetMap):",
    ...poiLines,
    "",
    "Devuelve entre 5 y 8 sugerencias en un array JSON usando solo osmId de la lista.",
  ].join("\n");

  const { text, error } = await callAI(SYSTEM_PROMPT, userPrompt);

  if (error) {
    return { suggestions: [], error };
  }

  if (!text) {
    return { suggestions: [], error: "La IA no devolvió sugerencias." };
  }

  const suggestions = parseDiscoverResponse(text, input.pois);
  if (suggestions.length === 0) {
    return {
      suggestions: fallbackSuggestions(input.pois),
      error: null,
    };
  }

  return { suggestions, error: null };
}

function parseDiscoverResponse(raw: string, pois: OverpassPoi[]): DiscoverSuggestion[] {
  const jsonText = extractJsonArray(raw);
  if (!jsonText) {
    return [];
  }

  const poiById = new Map(pois.map((poi) => [poi.osmId, poi]));
  const seen = new Set<string>();

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const suggestions: DiscoverSuggestion[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      const osmId = typeof record.osmId === "string" ? record.osmId.trim() : "";
      const reason =
        typeof record.reason === "string" ? record.reason.trim() : "Sugerido cerca de ti.";

      if (!osmId || seen.has(osmId)) {
        continue;
      }

      const poi = poiById.get(osmId);
      if (!poi) {
        continue;
      }

      seen.add(osmId);
      suggestions.push({
        osmId: poi.osmId,
        name: poi.name,
        category: poi.category,
        distanceMeters: poi.distanceMeters,
        lat: poi.lat,
        lng: poi.lng,
        reason: reason || "Sugerido cerca de ti.",
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}

function fallbackSuggestions(pois: OverpassPoi[]): DiscoverSuggestion[] {
  return pois.slice(0, 6).map((poi) => ({
    osmId: poi.osmId,
    name: poi.name,
    category: poi.category,
    distanceMeters: poi.distanceMeters,
    lat: poi.lat,
    lng: poi.lng,
    reason: "Lugar cercano encontrado en OpenStreetMap.",
  }));
}

function extractJsonArray(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    return trimmed;
  }

  const match = trimmed.match(/\[[\s\S]*\]/);
  return match?.[0] ?? null;
}
