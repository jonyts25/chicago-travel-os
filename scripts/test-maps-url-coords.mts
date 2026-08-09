import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractCoordinatesFromMapsUrl,
  parseGoogleMapsExport,
  parsePlaceFromMapsUrl,
} from "../src/lib/importers/google-maps";

const oakbrookUrl =
  "https://www.google.com/maps/place/Oakbrook+Center,+100+Oakbrook+Center,+Oak+Brook,+IL+60523,+Estados+Unidos/@41.8487603,-87.9530109,16z/data=!4m2!3m1!1s0x880e4c8c8c8c8c8c:0x1234567890abcdef";

assert.deepEqual(extractCoordinatesFromMapsUrl(oakbrookUrl), {
  lat: 41.8487603,
  lng: -87.9530109,
});

assert.equal(extractCoordinatesFromMapsUrl("https://maps.google.com/?q=Chicago"), null);

const parsedUrl = parsePlaceFromMapsUrl(oakbrookUrl, "Oakbrook Center");
assert.equal(parsedUrl.ok, true);
if (parsedUrl.ok) {
  assert.equal(parsedUrl.place.lat, 41.8487603);
  assert.equal(parsedUrl.place.lng, -87.9530109);
  assert.equal(parsedUrl.place.name, "Oakbrook Center");
}

const sampleCsv = readFileSync(
  resolve(process.cwd(), "fixtures/google-takeout-chicago.sample.csv"),
  "utf8",
);
const csvPlaces = parseGoogleMapsExport(sampleCsv, "google-takeout-chicago.sample.csv");
const louMalnatis = csvPlaces.find((place) => place.name.includes("Lou Malnati"));
assert.ok(louMalnatis, "expected Lou Malnati's row in sample CSV");
assert.equal(louMalnatis?.lat, 41.888);
assert.equal(louMalnatis?.lng, -87.635);

const traderJoes = csvPlaces.find(
  (place) => place.name === "Trader Joe's" && place.lat == null,
);
assert.ok(traderJoes, "expected Trader Joe's row without @coords in URL");

console.log("maps url coordinate checks passed");
