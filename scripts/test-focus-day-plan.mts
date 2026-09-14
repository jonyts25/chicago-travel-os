import assert from "node:assert/strict";
import { resolveFocusCategory } from "../src/lib/itinerary/day-constraints";
import { buildSingleDayPlan } from "../src/lib/itinerary/optimizer/plan";
import type { OptimizerDayContext, OptimizerPlace } from "../src/lib/itinerary/optimizer/types";

function museum(id: string, lat: number, lng: number): OptimizerPlace {
  return {
    id,
    lat,
    lng,
    durationMinutes: 120,
    priorityRank: 2,
    interest: "both",
    category: "Museo",
  };
}

const museums = [
  museum("field", 41.8663, -87.617),
  museum("art", 41.8796, -87.6237),
  museum("mca", 41.8972, -87.6212),
  museum("msi", 41.7906, -87.583),
];

const cafe: OptimizerPlace = {
  id: "cafe",
  lat: 41.878,
  lng: -87.625,
  durationMinutes: 45,
  priorityRank: 2,
  interest: "both",
  category: "Café",
};

const shopping: OptimizerPlace = {
  id: "shop",
  lat: 41.895,
  lng: -87.624,
  durationMinutes: 60,
  priorityRank: 3,
  interest: "both",
  category: "Compras",
};

const focusCategory = resolveFocusCategory("museos", ["Museo", "Café", "Compras"]);
assert.equal(focusCategory, "Museo");

const day: OptimizerDayContext = {
  dayId: "day-3",
  dayNumber: 3,
  lockedPlaceIds: [],
  lockedPlaces: [],
  usedMinutes: 0,
  centroid: null,
  dayActiveMinutesLimit: 10 * 60,
  dayStartMinutes: 9 * 60,
  focusCategory,
  focusLabel: "museos",
};

const plan = buildSingleDayPlan(
  {
    days: [day],
    pool: [...museums, cafe, shopping],
    usedPlaceIds: new Set(),
  },
  "day-3",
);

const ordered = plan.dayPlans[0]?.orderedPlaceIds ?? [];
assert.equal(ordered.length, 4);
assert.deepEqual(new Set(ordered), new Set(["field", "art", "mca", "msi"]));
assert.equal(ordered.includes("shop"), false);
assert.equal(plan.unassignedFocusDueToTime.length, 0);

const shorterDay: OptimizerDayContext = {
  ...day,
  dayActiveMinutesLimit: 5 * 60,
};

const overflowPlan = buildSingleDayPlan(
  {
    days: [shorterDay],
    pool: [...museums],
    usedPlaceIds: new Set(),
  },
  "day-3",
);

assert.ok(overflowPlan.unassignedFocusDueToTime.length > 0);

console.log("Focus day plan order:", ordered.join(" -> "));
console.log("Overflow focus unassigned:", overflowPlan.unassignedFocusDueToTime.length);
console.log("OK: museos focus prioritizes museums and keeps overflow unplanned.");
