import { callAI } from "@/lib/ai/call-ai";
import {
  CATEGORY_DURATION_MINUTES,
  type AIPlaceEnrichment,
  type PlaceCategory,
} from "@/lib/importers/types";

const VALID_CATEGORIES: PlaceCategory[] = [
  "Museo",
  "Restaurante",
  "Compras",
  "Atracción",
  "Café",
  "Otro",
];

const SYSTEM_PROMPT = `Eres un asistente que clasifica lugares turísticos de Chicago.
Responde SOLO con JSON válido, sin markdown ni texto extra.
Para cada lugar devuelve:
- originalName: el nombre tal como llegó
- cleanName: nombre limpio del negocio/lugar (sin reseñas pegadas, comillas, texto extra)
- category: exactamente una de: Museo, Restaurante, Compras, Atracción, Café, Otro`;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

export async function enrichPlacesWithAI(
  places: { name: string }[],
): Promise<Map<string, AIPlaceEnrichment>> {
  const results = new Map<string, AIPlaceEnrichment>();

  if (places.length === 0 || !process.env.ANTHROPIC_API_KEY) {
    return results;
  }

  for (let index = 0; index < places.length; index += BATCH_SIZE) {
    const batch = places.slice(index, index + BATCH_SIZE);

    try {
      const batchResults = await enrichBatch(batch);
      for (const item of batchResults) {
        results.set(item.originalName, item);
      }
    } catch {
      // Non-blocking: skip failed batch and continue.
    }

    if (index + BATCH_SIZE < places.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

async function enrichBatch(
  batch: { name: string }[],
): Promise<AIPlaceEnrichment[]> {
  const userPrompt = JSON.stringify(
    batch.map((place) => ({ originalName: place.name })),
    null,
    2,
  );

  const response = await callAI(
    SYSTEM_PROMPT,
    `Clasifica estos lugares y devuelve un array JSON:\n${userPrompt}`,
  );

  if (!response) {
    return [];
  }

  const parsed = parseEnrichmentResponse(response);
  return parsed.filter((item) => batch.some((place) => place.name === item.originalName));
}

function parseEnrichmentResponse(raw: string): AIPlaceEnrichment[] {
  const jsonText = extractJsonArray(raw);
  if (!jsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeEnrichmentItem)
      .filter((item): item is AIPlaceEnrichment => item !== null);
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

function normalizeEnrichmentItem(value: unknown): AIPlaceEnrichment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const originalName =
    typeof record.originalName === "string" ? record.originalName.trim() : "";
  const cleanName =
    typeof record.cleanName === "string" ? record.cleanName.trim() : originalName;
  const category = normalizeCategory(record.category);

  if (!originalName) {
    return null;
  }

  return {
    originalName,
    cleanName: cleanName || originalName,
    category,
  };
}

function normalizeCategory(value: unknown): PlaceCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return VALID_CATEGORIES.find((category) => category === trimmed) ?? "Otro";
}

export function applyAIEnrichment(
  place: { name: string; category: PlaceCategory | null; estimated_duration_minutes: number | null },
  enrichment: AIPlaceEnrichment | undefined,
): { withoutCategory: boolean } {
  if (!enrichment?.category) {
    return { withoutCategory: true };
  }

  place.name = enrichment.cleanName || place.name;
  place.category = enrichment.category;
  place.estimated_duration_minutes =
    CATEGORY_DURATION_MINUTES[enrichment.category];

  return { withoutCategory: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
