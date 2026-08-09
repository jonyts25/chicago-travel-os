import { callAI, isAnthropicConfigured } from "@/lib/ai/call-ai";
import type { ExtractedTravelConfirmation } from "@/lib/trips/travel-info";

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de confirmaciones de viaje (vuelos u hoteles).
Responde SOLO con JSON válido, sin markdown ni texto extra.

Devuelve un objeto JSON con estas claves:
- detectedType: "vuelo_ida" | "vuelo_vuelta" | "hotel" | "desconocido"
- flight_arrival: ISO 8601 datetime con zona horaria o null (llegada a Chicago / destino del viaje de ida)
- flight_departure: ISO 8601 datetime o null (salida de Chicago / vuelo de regreso)
- flight_outbound_number: string o null (número de vuelo de ida, ej. "UA 1234")
- flight_return_number: string o null (número de vuelo de regreso)
- hotel_checkin: ISO 8601 datetime o null
- hotel_checkout: ISO 8601 datetime o null
- base_location: string o null (dirección o nombre del hotel)
- summary: string breve en español explicando qué interpretaste

Reglas:
- El viaje es a Chicago, Illinois.
- vuelo_ida = llegada al destino del viaje; vuelo_vuelta = salida de regreso.
- Para hoteles, extrae check-in, check-out y dirección si aparecen.
- Si el texto incluye ambos vuelos, usa detectedType "desconocido" y llena todos los campos que encuentres.
- Usa null para campos que no puedas inferir con confianza.
- Fechas en ISO 8601 (preferir hora local de Chicago si se indica, si no UTC).`;

export async function extractTravelConfirmation(
  confirmationText: string,
): Promise<{ data: ExtractedTravelConfirmation | null; error: string | null }> {
  if (!isAnthropicConfigured()) {
    return {
      data: null,
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  const trimmed = confirmationText.trim();
  if (!trimmed) {
    return { data: null, error: "Pega el texto de la confirmación antes de extraer." };
  }

  const userPrompt = [
    "Extrae los datos estructurados de esta confirmación de viaje:",
    "",
    trimmed,
  ].join("\n");

  const { text, error } = await callAI(SYSTEM_PROMPT, userPrompt);
  if (error) {
    return { data: null, error };
  }

  if (!text) {
    return { data: null, error: "La IA no devolvió datos." };
  }

  const parsed = parseExtractedTravelResponse(text);
  if (!parsed) {
    return {
      data: null,
      error: "No se pudieron interpretar los datos extraídos. Revisa el texto e intenta de nuevo.",
    };
  }

  return { data: parsed, error: null };
}

function parseExtractedTravelResponse(raw: string): ExtractedTravelConfirmation | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return null;
  }

  try {
    const value = JSON.parse(jsonText) as Record<string, unknown>;
    const detectedType = normalizeDetectedType(value.detectedType);

    return {
      detectedType,
      flight_arrival: normalizeIso(value.flight_arrival),
      flight_departure: normalizeIso(value.flight_departure),
      flight_outbound_number: normalizeText(value.flight_outbound_number),
      flight_return_number: normalizeText(value.flight_return_number),
      hotel_checkin: normalizeIso(value.hotel_checkin),
      hotel_checkout: normalizeIso(value.hotel_checkout),
      base_location: normalizeText(value.base_location),
      summary: normalizeText(value.summary),
    };
  } catch {
    return null;
  }
}

function normalizeDetectedType(value: unknown): ExtractedTravelConfirmation["detectedType"] {
  if (
    value === "vuelo_ida" ||
    value === "vuelo_vuelta" ||
    value === "hotel" ||
    value === "desconocido"
  ) {
    return value;
  }

  return "desconocido";
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }

  return null;
}
