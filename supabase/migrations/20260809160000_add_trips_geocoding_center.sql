-- Trip center and search radius for Nominatim viewbox during geocoding.
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS search_radius_km integer NOT NULL DEFAULT 20;

COMMENT ON COLUMN trips.center_lat IS 'Trip map center latitude (e.g. hotel) for bounded Nominatim searches.';
COMMENT ON COLUMN trips.center_lng IS 'Trip map center longitude (e.g. hotel) for bounded Nominatim searches.';
COMMENT ON COLUMN trips.search_radius_km IS 'Approximate search radius in km for Nominatim viewbox.';
