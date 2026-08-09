export type OsmTagFilter = {
  key: string;
  value: string;
};

const DEFAULT_FILTERS: OsmTagFilter[] = [
  { key: "amenity", value: "restaurant" },
  { key: "amenity", value: "cafe" },
  { key: "tourism", value: "attraction" },
  { key: "tourism", value: "museum" },
  { key: "leisure", value: "park" },
  { key: "shop", value: "mall" },
];

function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function dedupeFilters(filters: OsmTagFilter[]): OsmTagFilter[] {
  const seen = new Set<string>();
  return filters.filter((filter) => {
    const key = `${filter.key}=${filter.value}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function inferOsmFiltersFromQuery(query: string): OsmTagFilter[] {
  const q = normalizeQuery(query);
  const filters: OsmTagFilter[] = [];

  if (
    /hambre|comer|comida|restaur|cenar|almorz|meriend|hungry|food|eat|dinner|lunch|breakfast|desayun/.test(
      q,
    )
  ) {
    filters.push(
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "fast_food" },
      { key: "amenity", value: "food_court" },
    );
  }

  if (/cafe|cafeter|coffee|desayun|brunch/.test(q)) {
    filters.push({ key: "amenity", value: "cafe" });
  }

  if (/bar|cerveza|drink|copas|tragos|night|noche/.test(q)) {
    filters.push({ key: "amenity", value: "bar" });
    filters.push({ key: "amenity", value: "pub" });
  }

  if (/museo|museum|arte|art|galer|cultura|historia/.test(q)) {
    filters.push({ key: "tourism", value: "museum" });
    filters.push({ key: "amenity", value: "arts_centre" });
  }

  if (/atracc|turismo|sight|landmark|monument|mirador/.test(q)) {
    filters.push({ key: "tourism", value: "attraction" });
    filters.push({ key: "historic", value: "monument" });
  }

  if (/parque|natur|tranquil|relax|paseo|walk|jardin|garden|calm/.test(q)) {
    filters.push({ key: "leisure", value: "park" });
    filters.push({ key: "leisure", value: "garden" });
  }

  if (/compr|shop|mall|tienda|mercad|market/.test(q)) {
    filters.push({ key: "shop", value: "mall" });
    filters.push({ key: "shop", value: "department_store" });
    filters.push({ key: "amenity", value: "marketplace" });
  }

  if (/helado|postre|dulce|dessert|ice cream|pastel/.test(q)) {
    filters.push({ key: "amenity", value: "ice_cream" });
    filters.push({ key: "shop", value: "bakery" });
  }

  if (filters.length === 0) {
    return [...DEFAULT_FILTERS];
  }

  return dedupeFilters(filters);
}
