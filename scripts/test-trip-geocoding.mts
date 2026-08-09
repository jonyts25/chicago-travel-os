import assert from "node:assert/strict";
import {
  buildGeocodeQueries,
  geocodePlaceWithRetries,
} from "../src/lib/geocoding/nominatim";
import {
  buildNominatimViewbox,
  normalizeTripGeocodingContext,
} from "../src/lib/geocoding/trip-geocoding-context";

const chicagoHotelContext = normalizeTripGeocodingContext({
  center_lat: 41.8882,
  center_lng: -87.6234,
  search_radius_km: 20,
  base_location: "71 E Wacker Dr, Chicago, IL",
});

assert.equal(
  buildNominatimViewbox(chicagoHotelContext),
  buildNominatimViewbox(chicagoHotelContext),
  "viewbox should be stable for the same input",
);

const viewbox = buildNominatimViewbox(chicagoHotelContext);
assert.ok(viewbox, "viewbox should be set when center coordinates exist");
assert.match(viewbox!, /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);

const [withLocation, fallback] = buildGeocodeQueries(
  "Art Institute",
  chicagoHotelContext,
);
assert.equal(withLocation, "Art Institute, 71 E Wacker Dr, Chicago, IL");
assert.equal(fallback, "Art Institute");

const noCenterContext = normalizeTripGeocodingContext({
  center_lat: null,
  center_lng: null,
  search_radius_km: 20,
  base_location: null,
});
assert.equal(buildNominatimViewbox(noCenterContext), null);
assert.deepEqual(buildGeocodeQueries("Art Institute", noCenterContext), [
  "Art Institute",
  "Art Institute",
]);

const onlyLatContext = normalizeTripGeocodingContext({
  center_lat: 41.8882,
  center_lng: null,
  search_radius_km: 20,
  base_location: "Hotel",
});
assert.equal(buildNominatimViewbox(onlyLatContext), null);

const defaultRadius = normalizeTripGeocodingContext({
  center_lat: 41.8882,
  center_lng: -87.6234,
  search_radius_km: null,
  base_location: null,
});
assert.equal(defaultRadius.search_radius_km, 20);

if (process.env.RUN_NOMINATIM_INTEGRATION === "1") {
  const result = await geocodePlaceWithRetries("Art Institute", chicagoHotelContext);
  assert.ok(result.lat && result.lng, "expected coordinates from bounded search");
  assert.ok(result.address, "expected addressdetails display name");
  console.log("integration geocode:", result);
}

console.log("trip geocoding checks passed");
