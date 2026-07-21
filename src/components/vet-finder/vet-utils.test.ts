import assert from "node:assert/strict";

import { VET_LOCATIONS } from "@/data/vet-locations";
import type { VetLocation } from "@/data/vet-locations";
import {
  filterVets,
  matchesServiceFilter,
  openingStatus,
  haversineDistance,
  buildSuggestions,
  formatDistance,
  type VetFilterState,
} from "./vet-utils";

const baseFilters: VetFilterState = {
  query: "",
  service: "",
  state: "",
  openNow: false,
  radiusKm: 0,
  userCoordinates: null,
};

const sydneyClinic: VetLocation = {
  id: "test-sydney",
  sample: false,
  name: "Test Sydney Vet",
  address: "1 Test St, Sydney NSW 2000",
  suburb: "Sydney",
  postcode: "2000",
  state: "NSW",
  area: "Sydney Metro",
  phone: "02 0000 0000",
  sms: "",
  latitude: -33.87,
  longitude: 151.21,
  markerPrecision: "address",
  services: ["Emergency & critical care", "Surgery"],
  openingHours: ["Mon–Fri: 9:00 am – 5:00 pm"],
  sourceLabel: "Test",
  sourceUrl: "https://example.com",
};

// Data integrity: 212 records with the documented state split.
assert.equal(VET_LOCATIONS.length, 212);
const stateCounts = VET_LOCATIONS.reduce<Record<string, number>>((acc, v) => {
  acc[v.state] = (acc[v.state] ?? 0) + 1;
  return acc;
}, {});
assert.equal(stateCounts.VIC, 118);
assert.equal(stateCounts.NSW, 80);

// Service keyword matching.
assert.equal(matchesServiceFilter(sydneyClinic, "emergency"), true);
assert.equal(matchesServiceFilter(sydneyClinic, "reproduction"), false);
assert.equal(matchesServiceFilter(sydneyClinic, ""), true);

// Opening status evaluated in the clinic's own timezone at a fixed instant.
// 2026-07-15 is a Wednesday; Sydney is AEST (UTC+10, no DST in July).
assert.equal(openingStatus(sydneyClinic, new Date("2026-07-15T00:00:00Z")), "open"); // 10:00 Sydney
assert.equal(openingStatus(sydneyClinic, new Date("2026-07-15T10:00:00Z")), "closed"); // 20:00 Sydney
// Unpublished hours -> null.
assert.equal(openingStatus({ ...sydneyClinic, openingHours: ["Contact clinic for current opening hours"] }), null);

// Haversine: distance from a point to itself is zero, and monotonic-ish.
assert.equal(Math.round(haversineDistance({ latitude: -33.87, longitude: 151.21 }, { latitude: -33.87, longitude: 151.21 })), 0);
assert.ok(haversineDistance({ latitude: -33.87, longitude: 151.21 }, { latitude: -37.81, longitude: 144.96 }) > 700);

// Filter pipeline: state filter narrows results, distance sort when located.
const nswOnly = filterVets(VET_LOCATIONS, { ...baseFilters, state: "NSW" });
assert.equal(nswOnly.length, 80);
assert.ok(nswOnly.every((v) => v.state === "NSW"));

const located = filterVets(VET_LOCATIONS, {
  ...baseFilters,
  userCoordinates: { latitude: -33.87, longitude: 151.21 },
});
assert.ok(located[0].distanceKm !== undefined);
assert.ok((located[0].distanceKm ?? 0) <= (located[located.length - 1].distanceKm ?? 0));

// Radius filter excludes far clinics.
const within50 = filterVets(VET_LOCATIONS, {
  ...baseFilters,
  userCoordinates: { latitude: -33.87, longitude: 151.21 },
  radiusKm: 50,
});
assert.ok(within50.every((v) => (v.distanceKm ?? Infinity) <= 50));
assert.ok(within50.length < located.length);

// Suggestions include known suburbs; distance formatting is tabular-friendly.
assert.ok(buildSuggestions(VET_LOCATIONS).includes("Newtown"));
assert.equal(formatDistance(3.14159), "3.1 km");
assert.equal(formatDistance(42.6), "43 km");

console.log("vet-utils tests passed");
