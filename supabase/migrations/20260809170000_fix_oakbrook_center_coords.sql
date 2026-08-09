-- Oakbrook Center was imported from a Maps URL with @lat,lng but coords were not parsed.
UPDATE places
SET
  lat = 41.8487603,
  lng = -87.9530109
WHERE id = 'b84c4bcb-5f61-4a16-9fcb-3e62f8e64a05'
  AND (lat IS NULL OR lng IS NULL);
