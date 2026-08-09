import assert from "node:assert/strict";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "../src/lib/itinerary/day-constraints";
import {
  getTripDayFromStartDate,
  resolveTripTodayPhase,
} from "../src/lib/hoy/today-types";
import { getCountdownLabel } from "../src/lib/hoy/countdown";
import {
  chicagoDatetimeLocalValueToIso,
  formatInChicagoTimeZone,
  getChicagoDateTimeParts,
  isoToChicagoDatetimeLocalValue,
} from "../src/lib/trips/chicago-time";
import { formatTripTimeFromIso } from "../src/lib/trips/travel-info";

const chicagoArrivalUtc = "2026-09-17T04:59:00.000Z";

assert.equal(
  isoToChicagoDatetimeLocalValue(chicagoArrivalUtc),
  "2026-09-16T23:59",
  "UTC instant should render as Chicago wall clock in datetime-local",
);

assert.equal(formatTripTimeFromIso(chicagoArrivalUtc), "11:59 PM");

const formatted = formatInChicagoTimeZone(chicagoArrivalUtc, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
assert.ok(formatted?.includes("11:59"), `expected 11:59 PM Chicago, got ${formatted}`);

const savedIso = chicagoDatetimeLocalValueToIso("2026-09-16T23:59");
assert.equal(savedIso, chicagoArrivalUtc, "Chicago local input should save as correct UTC instant");

const roundTrip = toDatetimeLocalValue(fromDatetimeLocalValue("2026-09-16T23:59")!);
assert.equal(roundTrip, "2026-09-16T23:59");

const parts = getChicagoDateTimeParts(chicagoArrivalUtc);
assert.equal(parts?.year, 2026);
assert.equal(parts?.month, 9);
assert.equal(parts?.day, 16);
assert.equal(parts?.hours, 23);
assert.equal(parts?.minutes, 59);

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

const chicagoNoonUtc = "2026-09-16T17:00:00.000Z";
assert.equal(
  getCountdownLabel("17:00:00", new Date(chicagoNoonUtc)),
  "En 5 h",
  "itinerary start_time should compare against Chicago clock, not device timezone",
);

console.log("chicago timezone checks passed");
