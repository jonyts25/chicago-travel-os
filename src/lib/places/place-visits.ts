export type PlaceVisit = {
  id: string;
  place_id: string;
  user_id: string;
  visited_at: string;
  rating: number;
  notes: string | null;
};

export type PlaceVisitSummary = {
  visitCount: number;
  averageRating: number | null;
};

export type PlaceVisitRow = {
  place_id: string;
  rating: number | null;
};

export function summarizePlaceVisits(rows: PlaceVisitRow[]): Map<string, PlaceVisitSummary> {
  const buckets = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();

  for (const row of rows) {
    const current = buckets.get(row.place_id) ?? { count: 0, ratingSum: 0, ratingCount: 0 };
    current.count += 1;

    if (row.rating != null && row.rating >= 1 && row.rating <= 5) {
      current.ratingSum += row.rating;
      current.ratingCount += 1;
    }

    buckets.set(row.place_id, current);
  }

  const summaries = new Map<string, PlaceVisitSummary>();

  for (const [placeId, bucket] of buckets) {
    summaries.set(placeId, {
      visitCount: bucket.count,
      averageRating:
        bucket.ratingCount > 0
          ? Math.round((bucket.ratingSum / bucket.ratingCount) * 10) / 10
          : null,
    });
  }

  return summaries;
}

export function formatVisitIndicator(summary: PlaceVisitSummary | undefined): string | null {
  if (!summary || summary.visitCount === 0) {
    return null;
  }

  if (summary.averageRating != null) {
    return `${summary.averageRating.toFixed(1)}★ · visitado`;
  }

  return "✓ Visitado";
}
