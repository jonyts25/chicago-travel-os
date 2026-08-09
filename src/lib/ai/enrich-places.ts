import { callAI, isAnthropicConfigured } from "@/lib/ai/call-ai";
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
Para cada lugar devuelve un objeto en un array JSON con:
- originalName: el nombre tal como llegó (copia exacta del input)
- cleanName: nombre limpio del negocio/lugar (sin reseñas pegadas, comillas, texto extra)
- category: exactamente una de: Museo, Restaurante, Compras, Atracción, Café, Otro`;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

export type EnrichPlacesResult = {
  enrichments: Map<string, AIPlaceEnrichment>;
  errors: string[];
};

export async function enrichPlacesWithAI(
  places: { name: string }[],
): Promise<EnrichPlacesResult> {
  const enrichments = new Map<string, AIPlaceEnrichment>();
  const errors: string[] = [];

  if (places.length === 0) {
    return { enrichments, errors };
  }

  if (!isAnthropicConfigured()) {
    errors.push(
      "ANTHROPIC_API_KEY no está configurada — no se ejecutó el enriquecimiento IA.",
    );
    return { enrichments, errors };
  }

  for (let index = 0; index < places.length; index += BATCH_SIZE) {
    const batch = places.slice(index, index + BATCH_SIZE);
    const batchNumber = Math.floor(index / BATCH_SIZE) + 1;

    const batchResult = await enrichBatch(batch, batchNumber);
    errors.push(...batchResult.errors);

    for (const [name, enrichment] of batchResult.enrichments) {
      enrichments.set(name, enrichment);
    }

    if (index + BATCH_SIZE < places.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  if (enrichments.size === 0 && errors.length === 0) {
    errors.push(
      "La IA no devolvió categorías parseables para ningún lote. Revisa el modelo o el formato de respuesta.",
    );
  }

  return { enrichments, errors };
}

async function enrichBatch(
  batch: { name: string }[],
  batchNumber: number,
): Promise<EnrichPlacesResult> {
  const enrichments = new Map<string, AIPlaceEnrichment>();
  const errors: string[] = [];

  const userPrompt = JSON.stringify(
    batch.map((place) => ({ originalName: place.name })),
    null,
    2,
  );

  const { text, error } = await callAI(
    SYSTEM_PROMPT,
    `Clasifica estos lugares de Chicago y devuelve un array JSON:\n${userPrompt}`,
  );

  if (error) {
    errors.push(`IA lote ${batchNumber}: ${error}`);
    return { enrichments, errors };
  }

  if (!text) {
    errors.push(`IA lote ${batchNumber}: respuesta vacía.`);
    return { enrichments, errors };
  }

  const parsed = parseEnrichmentResponse(text, batch);

  if (parsed.length === 0) {
    errors.push(
      `IA lote ${batchNumber}: no se pudo parsear JSON (${text.slice(0, 120)}…).`,
    );
    return { enrichments, errors };
  }

  for (const item of parsed) {
    enrichments.set(item.originalName, item);
  }

  return { enrichments, errors };
}

function parseEnrichmentResponse(
  raw: string,
  batch: { name: string }[],
): AIPlaceEnrichment[] {
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
      .map((item, index) => normalizeEnrichmentItem(item, batch[index]?.name))
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

function normalizeEnrichmentItem(
  value: unknown,
  fallbackOriginalName?: string,
): AIPlaceEnrichment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const originalName =
    (typeof record.originalName === "string" ? record.originalName.trim() : "") ||
    fallbackOriginalName?.trim() ||
    "";
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
  place: { name: string; category: PlaceCategory | null; duration_minutes: number | null },
  enrichment: AIPlaceEnrichment | undefined,
): { withoutCategory: boolean } {
  if (!enrichment?.category) {
    return { withoutCategory: true };
  }

  place.name = enrichment.cleanName || place.name;
  place.category = enrichment.category;
  place.duration_minutes = CATEGORY_DURATION_MINUTES[enrichment.category];

  return { withoutCategory: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
