-- Trip timezone for display and datetime conversion (defaults to Chicago).
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Chicago';

COMMENT ON COLUMN trips.timezone IS 'IANA timezone for trip-local clock times and timestamptz display (e.g. America/Chicago).';
