import { isAnthropicConfigured } from "@/lib/ai/call-ai";
import { callAIWithWebSearch } from "@/lib/ai/call-ai-web-search";
import { resolveTripTimezone } from "@/lib/trips/trip-time";

export type PlaceTicketResearchRecord = {
  id: string;
  placeId: string;
  summary: string;
  sources: PlaceTicketResearchSource[];
  webSearchCount: number;
  searchedAt: string;
};

export type PlaceTicketResearchSource = {
  title: string;
  url: string;
};

export type PlaceTicketResearchInput = {
  placeName: string;
  placeCategory: string | null;
  placeAddress: string | null;
  tripName: string;
  tripCity: string | null;
};

const SYSTEM_PROMPT = `Eres un asistente de planificación de viajes que investiga boletos, reservas y pases turísticos.
Usa búsqueda web para obtener información actualizada y responde en español claro y conciso.
Estructura la respuesta con estas secciones (omitir solo si no aplica):
1. ¿Requiere boleto/reserva anticipada?
2. ¿Cuándo conviene comprar?
3. ¿Dónde comprar (oficial, taquilla, etc.)?
4. ¿Algún city pass lo incluye?
5. Recomendación breve

Cita fuentes cuando sea posible. Si no encuentras info fiable, dilo explícitamente.`;

export async function researchPlaceTickets(
  input: PlaceTicketResearchInput,
): Promise<
  | {
      ok: true;
      summary: string;
      sources: PlaceTicketResearchSource[];
      webSearchCount: number;
    }
  | { ok: false; error: string }
> {
  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  const destination = input.tripCity?.trim() || input.tripName.trim() || "el destino del viaje";
  const locationHint = input.placeAddress?.trim() || destination;

  const userPrompt = [
    `Investiga información de tickets/reservas para este lugar del viaje "${input.tripName}":`,
    "",
    `- Lugar: ${input.placeName}`,
    input.placeCategory ? `- Categoría: ${input.placeCategory}` : null,
    `- Ubicación: ${locationHint}`,
    `- Destino del viaje: ${destination}`,
    "",
    "Responde específicamente:",
    "- ¿Requiere comprar boleto o reserva con anticipación?",
    "- ¿Cuál es el mejor momento para comprarlo (con cuánta anticipación)?",
    "- ¿Dónde se compra (sitio oficial, taquilla, etc.)?",
    "- ¿Algún City Pass u otro pase turístico local lo incluye?",
    "- Recomendación corta de qué conviene más comprar.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  const { text, sources, webSearchCount, error } = await callAIWithWebSearch(
    SYSTEM_PROMPT,
    userPrompt,
  );

  if (error || !text) {
    return { ok: false, error: error ?? "No se pudo investigar tickets." };
  }

  return {
    ok: true,
    summary: text,
    sources,
    webSearchCount,
  };
}

export function formatTicketResearchSearchedAt(
  isoDate: string,
  timezone?: string | null,
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("es", {
    timeZone: resolveTripTimezone(timezone),
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeTicketResearchSources(value: unknown): PlaceTicketResearchSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sources: PlaceTicketResearchSource[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";

    if (!url) {
      continue;
    }

    sources.push({ url, title: title || url });
  }

  return sources;
}
