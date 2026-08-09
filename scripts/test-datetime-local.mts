import assert from "node:assert/strict";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "../src/lib/itinerary/day-constraints";
import {
  getTripDayFromStartDate,
  resolveTripTodayPhase,
} from "../src/lib/hoy/today-types";

const chicagoTz = "America/Chicago";
const localValue = "2026-09-16T23:59";
const iso = fromDatetimeLocalValue(localValue, chicagoTz);
assert.ok(iso, "expected ISO string from datetime-local value");
assert.equal(iso, "2026-09-17T04:59:00.000Z", "Trip local time should map to UTC instant");

const roundTrip = toDatetimeLocalValue(iso!, chicagoTz);
assert.equal(roundTrip, localValue, "round-trip should preserve trip wall clock");

const tripStart = "2026-09-16";
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-15T12:00:00Z"), chicagoTz),
  "before_trip",
);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-16T12:00:00Z"), chicagoTz),
  "during_trip",
);
assert.equal(
  getTripDayFromStartDate(tripStart, new Date("2026-09-16T12:00:00Z"), chicagoTz),
  1,
);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-20T12:00:00Z"), chicagoTz),
  "after_trip",
);
assert.equal(resolveTripTodayPhase(null, new Date(), chicagoTz), "no_start_date");

console.log("datetime-local and hoy phase checks passed");
