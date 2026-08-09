import assert from "node:assert/strict";
import {
  arePlaceNamesSimilar,
  distanceMeters,
  findNearbyDuplicate,
} from "../src/lib/places/nearby-duplicate";

assert.equal(arePlaceNamesSimilar("Oakbrook Center", "Oakbrook Center Mall"), true);
assert.equal(arePlaceNamesSimilar("Art Institute", "Lou Malnati's"), false);

const distance = distanceMeters(41.8781, -87.6298, 41.8786, -87.6298);
assert.ok(distance > 0 && distance < 100, `expected short distance, got ${distance}`);

const duplicate = findNearbyDuplicate(
  { name: "Target", lat: 41.8781, lng: -87.6298 },
  [{ id: "1", name: "Target Store", lat: 41.87815, lng: -87.62985 }],
);
assert.ok(duplicate, "expected nearby duplicate match");
assert.ok(duplicate!.distanceMeters < 30);

const farDuplicate = findNearbyDuplicate(
  { name: "Target", lat: 41.8781, lng: -87.6298 },
  [{ id: "2", name: "Target", lat: 42.0, lng: -87.6298 }],
);
assert.equal(farDuplicate, null);

console.log("place search helper checks passed");
