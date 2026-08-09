import assert from "node:assert/strict";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "../src/lib/itinerary/day-constraints";
import {
  getTripDayFromStartDate,
  resolveTripTodayPhase,
} from "../src/lib/hoy/today-types";

const localValue = "2026-09-16T04:59";
const iso = fromDatetimeLocalValue(localValue);
assert.ok(iso, "expected ISO string from datetime-local value");
assert.match(iso!, /^2026-09-16T/, "year must come from the input, not a default");

const roundTrip = toDatetimeLocalValue(iso!);
assert.equal(roundTrip, localValue, "round-trip should preserve local datetime parts");

const badYear = fromDatetimeLocalValue("2024-09-16T04:59");
assert.ok(badYear);
assert.match(badYear!, /^2024-09-16T/);

const tripStart = "2026-09-16";
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-15T12:00:00")),
  "before_trip",
);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-16T12:00:00")),
  "during_trip",
);
assert.equal(getTripDayFromStartDate(tripStart, new Date("2026-09-16T12:00:00")), 1);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-20T12:00:00")),
  "after_trip",
);
assert.equal(resolveTripTodayPhase(null), "no_start_date");

console.log("datetime-local and hoy phase checks passed");
