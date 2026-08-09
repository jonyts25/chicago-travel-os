import type { ExistingPlace, ParsedGooglePlace } from "@/lib/importers/types";

type GeoJsonFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

type GeoJsonCollection = {
  type?: string;
  features?: GeoJsonFeature[];
};

const CSV_FIELD_ALIASES: Record<string, string> = {
  titulo: "title",
  title: "title",
  name: "title",
  nota: "note",
  note: "note",
  url: "url",
  link: "url",
  etiquetas: "tags",
  tags: "tags",
  comentario: "comment",
  comment: "comment",
  address: "address",
  direccion: "address",
};

export function parseGoogleMapsExport(
  content: string,
  filename?: string,
): ParsedGooglePlace[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const format = detectFormat(trimmed, filename);
  if (format === "json") {
    return parseJsonExport(trimmed);
  }

  return parseCsvExport(trimmed);
}

export type ParsedPlaceWithId = ParsedGooglePlace & { google_place_id: string };

export type PlaceToUpdate = ParsedPlaceWithId & { existingId: string };

export function partitionPlacesForImport(
  incoming: ParsedPlaceWithId[],
  existing: ExistingPlace[],
): { toInsert: ParsedPlaceWithId[]; toUpdate: PlaceToUpdate[] } {
  const existingByGoogleId = new Map<string, string>();

  for (const place of existing) {
    if (place.google_place_id) {
      existingByGoogleId.set(place.google_place_id, place.id);
    }
  }

  const toInsert: ParsedPlaceWithId[] = [];
  const toUpdate: PlaceToUpdate[] = [];
  const seenInCsv = new Set<string>();

  for (const place of incoming) {
    if (seenInCsv.has(place.google_place_id)) {
      continue;
    }
    seenInCsv.add(place.google_place_id);

    const existingId = existingByGoogleId.get(place.google_place_id);
    if (existingId) {
      toUpdate.push({ ...place, existingId });
      continue;
    }

    toInsert.push(place);
  }

  return { toInsert, toUpdate };
}

/** @deprecated Use partitionPlacesForImport */
export function partitionPlacesByDuplicates(
  incoming: ParsedGooglePlace[],
  existing: ExistingPlace[],
): { toInsert: ParsedGooglePlace[]; duplicates: ParsedGooglePlace[] } {
  const withIds = incoming.filter(
    (place): place is ParsedPlaceWithId => Boolean(place.google_place_id),
  );
  const { toInsert, toUpdate } = partitionPlacesForImport(withIds, existing);
  return { toInsert, duplicates: toUpdate };
}

/**
 * Extracts the Google feature id (0xHEX:0xHEX) from Takeout Maps URLs.
 * Example: .../data=!4m2!3m1!1s0x880fd3932a5c4c29:0x7a5707ce50c03ef1
 */
export function extractGoogleFeatureIdFromMapsUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/!1s(0x[a-fA-F0-9]+:0x[a-fA-F0-9]+)/);
  return match?.[1] ?? null;
}

/**
 * Tries to read the place name from a Google Maps share URL path segment.
 * Example: /maps/place/Art+Institute+of+Chicago/...
 */
export function extractPlaceNameFromMapsUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch?.[1]) {
      return decodeGoogleMapsPlaceSegment(placeMatch[1]);
    }

    const searchMatch = parsed.pathname.match(/\/maps\/search\/([^/]+)/);
    if (searchMatch?.[1]) {
      return decodeGoogleMapsPlaceSegment(searchMatch[1]);
    }
  } catch {
    return null;
  }

  return null;
}

export type ParseMapsUrlResult =
  | {
      ok: true;
      place: ParsedPlaceWithId;
      extractedName: string | null;
    }
  | {
      ok: false;
      error: string;
      needsManualName?: boolean;
    };

export function parsePlaceFromMapsUrl(
  mapsUrl: string,
  manualName?: string,
): ParseMapsUrlResult {
  const trimmedUrl = mapsUrl.trim();
  if (!trimmedUrl) {
    return { ok: false, error: "Pega un enlace de Google Maps." };
  }

  const googlePlaceId = extractGoogleFeatureIdFromMapsUrl(trimmedUrl);
  if (!googlePlaceId) {
    return {
      ok: false,
      error:
        "No se encontró el identificador !1s (CID) en la URL. Usa el enlace completo de Google Maps.",
    };
  }

  const extractedName = extractPlaceNameFromMapsUrl(trimmedUrl);
  const resolvedName = manualName?.trim() || extractedName;

  if (!resolvedName) {
    return {
      ok: false,
      error: "Escribe el nombre del lugar — no se pudo detectar en el enlace.",
      needsManualName: true,
    };
  }

  return {
    ok: true,
    extractedName,
    place: {
      name: resolvedName,
      lat: null,
      lng: null,
      address: null,
      google_place_id: googlePlaceId,
      maps_url: trimmedUrl,
      notes: null,
      category: null,
      duration_minutes: null,
    },
  };
}

export function resolveMapsUrlFromShareParams(params: {
  url?: string;
  text?: string;
  title?: string;
}): string {
  const candidates = [params.url, params.text, params.title].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const candidate of candidates) {
    const resolved = extractFirstGoogleMapsUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function extractFirstGoogleMapsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (isGoogleMapsUrl(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(
    /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl)[^\s"'<>]*/i,
  );
  return match?.[0] ?? null;
}

function isGoogleMapsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "maps.app.goo.gl") {
      return true;
    }

    return parsed.hostname.includes("google.") && parsed.pathname.includes("/maps");
  } catch {
    return false;
  }
}

function decodeGoogleMapsPlaceSegment(segment: string): string | null {
  const decoded = decodeURIComponent(segment.replace(/\+/g, " ")).trim();
  return decoded.length > 0 ? decoded : null;
}

function detectFormat(content: string, filename?: string): "json" | "csv" {
  const lowerName = filename?.toLowerCase() ?? "";
  if (lowerName.endsWith(".csv")) {
    return "csv";
  }
  if (lowerName.endsWith(".json") || lowerName.endsWith(".geojson")) {
    return "json";
  }

  if (content.startsWith("{") || content.startsWith("[")) {
    return "json";
  }

  return "csv";
}

function parseJsonExport(content: string): ParsedGooglePlace[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const features = extractGeoJsonFeatures(parsed);
  const places: ParsedGooglePlace[] = [];

  for (const feature of features) {
    const place = parseGeoJsonFeature(feature);
    if (place) {
      places.push(place);
    }
  }

  return places;
}

function extractGeoJsonFeatures(parsed: unknown): GeoJsonFeature[] {
  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed.filter(isGeoJsonFeature);
  }

  const collection = parsed as GeoJsonCollection;
  if (collection.type === "FeatureCollection" && Array.isArray(collection.features)) {
    return collection.features.filter(isGeoJsonFeature);
  }

  if (collection.type === "Feature") {
    return [collection as GeoJsonFeature];
  }

  if (Array.isArray(collection.features)) {
    return collection.features.filter(isGeoJsonFeature);
  }

  return [];
}

function isGeoJsonFeature(value: unknown): value is GeoJsonFeature {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function parseGeoJsonFeature(feature: GeoJsonFeature): ParsedGooglePlace | null {
  const properties = feature.properties ?? {};
  const location = readRecord(properties.Location ?? properties.location);

  const name = readString(
    properties.Title ??
      properties.title ??
      location?.["Business Name"] ??
      location?.["business name"],
  );

  if (!name) {
    return null;
  }

  const mapsUrl = readString(
    properties["Google Maps URL"] ??
      properties["google maps url"] ??
      properties.URL ??
      properties.url,
  );

  const address = readString(
    location?.Address ??
      location?.address ??
      properties.Address ??
      properties.address,
  );

  const geometryCoords = readGeometryCoordinates(feature.geometry?.coordinates);
  const propertyCoords = readLocationCoordinates(location);
  const normalizedCoords = normalizeCoordinates(
    geometryCoords?.lat ?? propertyCoords?.lat ?? null,
    geometryCoords?.lng ?? propertyCoords?.lng ?? null,
  );

  return {
    name,
    lat: normalizedCoords?.lat ?? null,
    lng: normalizedCoords?.lng ?? null,
    address,
    google_place_id: extractGoogleFeatureIdFromMapsUrl(mapsUrl),
    maps_url: mapsUrl,
    notes: null,
    category: null,
    duration_minutes: null,
  };
}

function parseCsvExport(content: string): ParsedGooglePlace[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => normalizeCsvHeader(header));

  const places: ParsedGooglePlace[] = [];

  for (const row of dataRows) {
    const place = parseCsvRow(headers, row);
    if (place) {
      places.push(place);
    }
  }

  return places;
}

function parseCsvRow(headers: string[], values: string[]): ParsedGooglePlace | null {
  const record = mapCsvRecord(headers, values);

  const name = readString(record.title);
  if (!name) {
    return null;
  }

  const mapsUrl = readString(record.url);

  return {
    name,
    lat: null,
    lng: null,
    address: null,
    google_place_id: extractGoogleFeatureIdFromMapsUrl(mapsUrl),
    maps_url: mapsUrl,
    notes: buildNotesFromCsvRecord(record),
    category: null,
    duration_minutes: null,
  };
}

function buildNotesFromCsvRecord(record: Record<string, string>): string | null {
  const parts: string[] = [];

  const note = readString(record.note);
  const tags = readString(record.tags);
  const comment = readString(record.comment);

  if (note) {
    parts.push(`Nota: ${note}`);
  }
  if (tags) {
    parts.push(`Etiquetas: ${tags}`);
  }
  if (comment) {
    parts.push(`Comentario: ${comment}`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function mapCsvRecord(headers: string[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};

  headers.forEach((header, index) => {
    const canonical = CSV_FIELD_ALIASES[header] ?? header;
    const value = values[index]?.trim() ?? "";
    if (value) {
      record[canonical] = value;
    }
  });

  return record;
}

function normalizeCsvHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function readGeometryCoordinates(
  coordinates: unknown,
): { lat: number; lng: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  return normalizeCoordinates(lat, lng);
}

function readLocationCoordinates(
  location: Record<string, unknown> | null,
): { lat: number; lng: number } | null {
  if (!location) {
    return null;
  }

  const geoCoordinates = readRecord(
    location["Geo Coordinates"] ?? location["geo coordinates"],
  );

  const lat = parseCoordinate(
    geoCoordinates?.Latitude ??
      geoCoordinates?.latitude ??
      location.Latitude ??
      location.latitude,
  );
  const lng = parseCoordinate(
    geoCoordinates?.Longitude ??
      geoCoordinates?.longitude ??
      location.Longitude ??
      location.longitude,
  );

  return normalizeCoordinates(lat, lng);
}

function normalizeCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null) {
    return null;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  if (lat === 0 && lng === 0) {
    return null;
  }

  return { lat, lng };
}

function parseCoordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
