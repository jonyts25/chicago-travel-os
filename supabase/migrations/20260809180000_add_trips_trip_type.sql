-- Trip mode: scheduled (fixed dates / itinerary) vs ongoing (continuous use).
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS trip_type text NOT NULL DEFAULT 'scheduled';

COMMENT ON COLUMN trips.trip_type IS 'scheduled = fixed trip with itinerary days; ongoing = continuous local use without dates.';
