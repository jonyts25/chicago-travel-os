export const NEARBY_DUPLICATE_RADIUS_METERS = 30;

export type NearbyPlaceRecord = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type NearbyDuplicateMatch = NearbyPlaceRecord & {
  distanceMeters: number;
};

export function normalizePlaceNameForComparison(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function arePlaceNamesSimilar(a: string, b: string): boolean {
  const left = normalizePlaceNameForComparison(a);
  const right = normalizePlaceNameForComparison(b);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (left.includes(right) || right.includes(left)) {
    return true;
  }

  const leftTokens = left.split(" ").filter((token) => token.length > 2);
  const rightTokens = new Set(
    right.split(" ").filter((token) => token.length > 2),
  );
  const overlap = leftTokens.filter((token) => rightTokens.has(token)).length;
  const minimumOverlap = Math.min(leftTokens.length, rightTokens.size, 2);

  return overlap >= minimumOverlap && overlap > 0;
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const latDelta = ((lat2 - lat1) * Math.PI) / 180;
  const lngDelta = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearbyDuplicate(
  candidate: { name: string; lat: number; lng: number },
  existingPlaces: NearbyPlaceRecord[],
  maxDistanceMeters: number = NEARBY_DUPLICATE_RADIUS_METERS,
): NearbyDuplicateMatch | null {
  let closest: NearbyDuplicateMatch | null = null;

  for (const place of existingPlaces) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      continue;
    }

    if (!arePlaceNamesSimilar(candidate.name, place.name)) {
      continue;
    }

    const distance = distanceMeters(
      candidate.lat,
      candidate.lng,
      place.lat,
      place.lng,
    );

    if (distance > maxDistanceMeters) {
      continue;
    }

    if (!closest || distance < closest.distanceMeters) {
      closest = { ...place, distanceMeters: distance };
    }
  }

  return closest;
}
