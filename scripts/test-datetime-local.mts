import assert from "node:assert/strict";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "../src/lib/itinerary/day-constraints";
import {
  getTripDayFromStartDate,
  resolveTripTodayPhase,
} from "../src/lib/hoy/today-types";

const localValue = "2026-09-16T23:59";
const iso = fromDatetimeLocalValue(localValue);
assert.ok(iso, "expected ISO string from datetime-local value");
assert.equal(iso, "2026-09-17T04:59:00.000Z", "Chicago local time should map to UTC instant");

const roundTrip = toDatetimeLocalValue(iso!);
assert.equal(roundTrip, localValue, "round-trip should preserve Chicago wall clock");

const tripStart = "2026-09-16";
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-15T12:00:00Z")),
  "before_trip",
);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-16T12:00:00Z")),
  "during_trip",
);
assert.equal(getTripDayFromStartDate(tripStart, new Date("2026-09-16T12:00:00Z")), 1);
assert.equal(
  resolveTripTodayPhase(tripStart, new Date("2026-09-20T12:00:00Z")),
  "after_trip",
);
assert.equal(resolveTripTodayPhase(null), "no_start_date");

console.log("datetime-local and hoy phase checks passed");
