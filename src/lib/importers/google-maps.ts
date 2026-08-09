import { PLACE_COORDINATE_DEDUP_METERS } from "@/lib/constants";
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

export function partitionPlacesByDuplicates(
  incoming: ParsedGooglePlace[],
  existing: ExistingPlace[],
): { toInsert: ParsedGooglePlace[]; duplicates: ParsedGooglePlace[] } {
  const toInsert: ParsedGooglePlace[] = [];
  const duplicates: ParsedGooglePlace[] = [];
  const known: ExistingPlace[] = [...existing];

  for (const place of incoming) {
    if (findDuplicate(place, known)) {
      duplicates.push(place);
      continue;
    }

    toInsert.push(place);
    known.push(parsedPlaceToExistingShape(place));
  }

  return { toInsert, duplicates };
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
  const urlCoords = extractCoordinatesFromUrl(mapsUrl);

  const latitude =
    geometryCoords?.latitude ??
    propertyCoords?.latitude ??
    urlCoords?.latitude ??
    null;
  const longitude =
    geometryCoords?.longitude ??
    propertyCoords?.longitude ??
    urlCoords?.longitude ??
    null;

  const normalizedCoords = normalizeCoordinates(latitude, longitude);

  return {
    name,
    latitude: normalizedCoords?.latitude ?? null,
    longitude: normalizedCoords?.longitude ?? null,
    address,
    google_place_id:
      extractGooglePlaceId(mapsUrl) ??
      extractGooglePlaceId(readString(properties["Google Maps URL"])),
    maps_url: mapsUrl,
  };
}

function parseCsvExport(content: string): ParsedGooglePlace[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim().toLowerCase());

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

  const name = readString(record.title ?? record.name);
  if (!name) {
    return null;
  }

  const mapsUrl = readString(record.url ?? record.link);
  const address = readString(record.address);
  const urlCoords = extractCoordinatesFromUrl(mapsUrl);

  const latitude = parseCoordinate(record.latitude ?? record.lat) ?? urlCoords?.latitude ?? null;
  const longitude =
    parseCoordinate(record.longitude ?? record.lng ?? record.lon) ??
    urlCoords?.longitude ??
    null;

  const normalizedCoords = normalizeCoordinates(latitude, longitude);

  return {
    name,
    latitude: normalizedCoords?.latitude ?? null,
    longitude: normalizedCoords?.longitude ?? null,
    address,
    google_place_id: extractGooglePlaceId(mapsUrl),
    maps_url: mapsUrl,
  };
}

function mapCsvRecord(headers: string[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};

  headers.forEach((header, index) => {
    record[header] = values[index]?.trim() ?? "";
  });

  return record;
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

export function extractGooglePlaceId(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const placeId = parsedUrl.searchParams.get("place_id");
    if (placeId) {
      return placeId;
    }

    const queryPlaceId = parsedUrl.searchParams.get("q");
    if (queryPlaceId?.startsWith("place_id:")) {
      return queryPlaceId.replace("place_id:", "");
    }

    const cid = parsedUrl.searchParams.get("cid");
    if (cid) {
      return `cid:${cid}`;
    }

    const ludocid = parsedUrl.searchParams.get("ludocid");
    if (ludocid) {
      return `ludocid:${ludocid}`;
    }
  } catch {
    // Fall through to regex parsing for malformed URLs.
  }

  const hexPairMatch = url.match(/!1s(0x[a-fA-F0-9]+:0x[a-fA-F0-9]+)/);
  if (hexPairMatch?.[1]) {
    return hexPairMatch[1];
  }

  const hexPairMatchAlt = url.match(/(0x[a-fA-F0-9]+:0x[a-fA-F0-9]+)/);
  if (hexPairMatchAlt?.[1]) {
    return hexPairMatchAlt[1];
  }

  const chijMatch = url.match(/(ChI[a-zA-Z0-9_-]{20,})/);
  if (chijMatch?.[1]) {
    return chijMatch[1];
  }

  return null;
}

export function extractCoordinatesFromUrl(
  url: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!url) {
    return null;
  }

  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return normalizeCoordinates(Number(atMatch[1]), Number(atMatch[2]));
  }

  const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataMatch) {
    return normalizeCoordinates(Number(dataMatch[1]), Number(dataMatch[2]));
  }

  const searchMatch = url.match(/\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
  if (searchMatch) {
    return normalizeCoordinates(Number(searchMatch[1]), Number(searchMatch[2]));
  }

  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    return normalizeCoordinates(Number(llMatch[1]), Number(llMatch[2]));
  }

  return null;
}

function readGeometryCoordinates(
  coordinates: unknown,
): { latitude: number; longitude: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  return normalizeCoordinates(latitude, longitude);
}

function readLocationCoordinates(
  location: Record<string, unknown> | null,
): { latitude: number; longitude: number } | null {
  if (!location) {
    return null;
  }

  const geoCoordinates = readRecord(
    location["Geo Coordinates"] ?? location["geo coordinates"],
  );

  const latitude = parseCoordinate(
    geoCoordinates?.Latitude ??
      geoCoordinates?.latitude ??
      location.Latitude ??
      location.latitude,
  );
  const longitude = parseCoordinate(
    geoCoordinates?.Longitude ??
      geoCoordinates?.longitude ??
      location.Longitude ??
      location.longitude,
  );

  return normalizeCoordinates(latitude, longitude);
}

function normalizeCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number; longitude: number } | null {
  if (latitude == null || longitude == null) {
    return null;
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return { latitude, longitude };
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

function findDuplicate(
  place: ParsedGooglePlace,
  existing: ExistingPlace[],
): ExistingPlace | null {
  if (place.google_place_id) {
    const byPlaceId = existing.find(
      (item) =>
        item.google_place_id != null &&
        item.google_place_id === place.google_place_id,
    );
    if (byPlaceId) {
      return byPlaceId;
    }
  }

  if (place.latitude != null && place.longitude != null) {
    const byCoordinates = existing.find((item) => {
      if (item.latitude == null || item.longitude == null) {
        return false;
      }

      return (
        haversineDistanceMeters(
          place.latitude!,
          place.longitude!,
          item.latitude,
          item.longitude,
        ) <= PLACE_COORDINATE_DEDUP_METERS
      );
    });

    if (byCoordinates) {
      return byCoordinates;
    }
  }

  return null;
}

function parsedPlaceToExistingShape(place: ParsedGooglePlace): ExistingPlace {
  return {
    id: `pending-${place.name}-${place.google_place_id ?? "no-id"}`,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    google_place_id: place.google_place_id,
  };
}

function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}
