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
  DEFAULT_TRIP_TIMEZONE,
  formatInTripTimeZone,
  getTripDateTimeParts,
  isoToTripDatetimeLocalValue,
  resolveTripTimezone,
  tripDatetimeLocalValueToIso,
} from "../src/lib/trips/trip-time";
import {
  formatFlightDepartureCutoffTime,
  formatFlightDepartureTime,
  formatTripTimeFromIso,
  getFlightDepartureCutoffMinutes,
} from "../src/lib/trips/travel-info";

const chicagoTz = "America/Chicago";
const chicagoArrivalUtc = "2026-09-17T04:59:00.000Z";

assert.equal(resolveTripTimezone(null), DEFAULT_TRIP_TIMEZONE);
assert.equal(resolveTripTimezone(""), DEFAULT_TRIP_TIMEZONE);
assert.equal(resolveTripTimezone("America/New_York"), "America/New_York");

assert.equal(
  isoToTripDatetimeLocalValue(chicagoArrivalUtc, chicagoTz),
  "2026-09-16T23:59",
  "UTC instant should render as trip wall clock in datetime-local",
);

assert.equal(formatTripTimeFromIso(chicagoArrivalUtc, chicagoTz), "11:59 PM");

const formatted = formatInTripTimeZone(
  chicagoArrivalUtc,
  chicagoTz,
  {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  },
);
assert.ok(formatted?.includes("11:59"), `expected 11:59 PM Chicago, got ${formatted}`);

const savedIso = tripDatetimeLocalValueToIso("2026-09-16T23:59", chicagoTz);
assert.equal(savedIso, chicagoArrivalUtc, "Trip local input should save as correct UTC instant");

const roundTrip = toDatetimeLocalValue(
  fromDatetimeLocalValue("2026-09-16T23:59", chicagoTz)!,
  chicagoTz,
);
assert.equal(roundTrip, "2026-09-16T23:59");

const parts = getTripDateTimeParts(chicagoArrivalUtc, chicagoTz);
assert.equal(parts?.year, 2026);
assert.equal(parts?.month, 9);
assert.equal(parts?.day, 16);
assert.equal(parts?.hours, 23);
assert.equal(parts?.minutes, 59);

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

const chicagoNoonUtc = "2026-09-16T17:00:00.000Z";
assert.equal(
  getCountdownLabel("17:00:00", chicagoTz, new Date(chicagoNoonUtc)),
  "En 5 h",
  "itinerary start_time should compare against trip clock, not device timezone",
);

const flightDepartureUtc = "2026-09-19T17:30:00.000Z";
assert.equal(formatFlightDepartureTime(flightDepartureUtc, chicagoTz), "12:30 PM");
assert.equal(
  getFlightDepartureCutoffMinutes(flightDepartureUtc, 60, chicagoTz),
  11 * 60 + 30,
);
assert.equal(
  formatFlightDepartureCutoffTime(flightDepartureUtc, 60, chicagoTz),
  "11:30 AM",
);

console.log("trip timezone checks passed");
