import type { OptimizerPlace } from "@/lib/itinerary/optimizer/types";

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function averageLatLng(points: LatLng[]): LatLng | null {
  if (points.length === 0) {
    return null;
  }

  const totals = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length,
  };
}

export function nearestNeighborOrder(
  places: OptimizerPlace[],
  startFrom: LatLng | null,
): OptimizerPlace[] {
  if (places.length <= 1) {
    return [...places];
  }

  const remaining = [...places];
  const ordered: OptimizerPlace[] = [];

  let current: LatLng | null = startFrom;

  if (!current) {
    remaining.sort((a, b) => a.priorityRank - b.priorityRank);
    const first = remaining.shift();
    if (!first) {
      return [];
    }
    ordered.push(first);
    current = first;
  }

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = haversineKm(current, candidate);
      const priorityBias = candidate.priorityRank * 0.05;
      const score = distance + priorityBias;

      if (score < bestDistance) {
        bestDistance = score;
        bestIndex = index;
      }
    }

    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = next;
  }

  return ordered;
}

export function kMeansClusterAssignments(
  places: OptimizerPlace[],
  clusterCount: number,
  maxIterations = 25,
): number[] {
  if (places.length === 0) {
    return [];
  }

  const k = Math.max(1, Math.min(clusterCount, places.length));
  const centroids = initializeCentroids(places, k);
  const assignments = new Array<number>(places.length).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (let index = 0; index < places.length; index += 1) {
      const clusterIndex = nearestCentroidIndex(places[index], centroids);
      if (assignments[index] !== clusterIndex) {
        assignments[index] = clusterIndex;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }

    for (let clusterIndex = 0; clusterIndex < k; clusterIndex += 1) {
      const clusterPoints = places.filter((_, index) => assignments[index] === clusterIndex);
      const centroid = averageLatLng(clusterPoints);
      if (centroid) {
        centroids[clusterIndex] = centroid;
      }
    }
  }

  return assignments;
}

function initializeCentroids(places: OptimizerPlace[], k: number): LatLng[] {
  const centroids: LatLng[] = [places[0]];

  while (centroids.length < k) {
    let bestPoint = places[0];
    let bestDistance = -1;

    for (const point of places) {
      const nearest = Math.min(...centroids.map((centroid) => haversineKm(point, centroid)));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestPoint = point;
      }
    }

    centroids.push(bestPoint);
  }

  return centroids;
}

function nearestCentroidIndex(point: LatLng, centroids: LatLng[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < centroids.length; index += 1) {
    const distance = haversineKm(point, centroids[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
