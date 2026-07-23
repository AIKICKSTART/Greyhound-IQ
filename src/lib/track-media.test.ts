import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { trackMediaPathForName } from "./track-media";

const expectedMediaPaths = [
  ["Angle Park", "/images/tracks/angle-park/master.webp"],
  ["Ballarat", "/images/tracks/ballarat/master.webp"],
  ["Bendigo", "/images/tracks/bendigo/master.webp"],
  ["Bet Nation Townsville", "/images/tracks/townsville/master.webp"],
  ["BetDeluxe Capalaba", "/images/tracks/capalaba/master.webp"],
  ["BetDeluxe Rockhampton", "/images/tracks/rockhampton/master.webp"],
  ["Bulli", "/images/tracks/bulli/master.webp"],
  ["Cannington", "/images/tracks/cannington/master.webp"],
  ["Casino", "/images/tracks/casino/master.webp"],
  ["Darwin", "/images/tracks/darwin/master.webp"],
  ["Dubbo", "/images/tracks/dubbo/master.webp"],
  ["Gawler", "/images/tracks/gawler/master.webp"],
  ["Geelong", "/images/tracks/geelong/master.webp"],
  ["Gosford", "/images/tracks/gosford/master.webp"],
  ["Goulburn", "/images/tracks/goulburn/master.webp"],
  ["Grafton", "/images/tracks/grafton/master.webp"],
  ["Gunnedah", "/images/tracks/gunnedah/master.webp"],
  ["Healesville", "/images/tracks/healesville/master.webp"],
  ["Hobart", "/images/tracks/hobart/master.webp"],
  ["Horsham", "/images/tracks/horsham/master.webp"],
  ["Ladbrokes Gardens", "/images/tracks/ladbrokes-gardens/master.webp"],
  ["Ladbrokes Q Straight", "/images/tracks/q-straight/master.webp"],
  ["Ladbrokes Q1 Lakeside", "/images/tracks/q1-lakeside/master.webp"],
  ["Ladbrokes Q2 Parklands", "/images/tracks/q2-parklands/master.webp"],
  ["Launceston", "/images/tracks/launceston/master.webp"],
  ["Maitland", "/images/tracks/maitland/master.webp"],
  ["Mandurah", "/images/tracks/mandurah/master.webp"],
  ["Meadows", "/images/tracks/the-meadows/master.webp"],
  ["Mount Gambier", "/images/tracks/mount-gambier/master.webp"],
  ["Murray Bridge", "/images/tracks/murray-bridge/master.webp"],
  [
    "Murray Bridge Straight",
    "/images/tracks/murray-bridge-straight/master.webp",
  ],
  ["Northam", "/images/tracks/northam/master.webp"],
  ["Nowra", "/images/tracks/nowra/master.webp"],
  ["Richmond", "/images/tracks/richmond/master.webp"],
  ["Richmond Straight", "/images/tracks/richmond-straight/master.webp"],
  ["Sale", "/images/tracks/sale/master.webp"],
  ["Sandown", "/images/tracks/sandown-park/master.webp"],
  ["Shepparton", "/images/tracks/shepparton/master.webp"],
  ["Taree", "/images/tracks/taree/master.webp"],
  ["Temora", "/images/tracks/temora/master.webp"],
  ["Traralgon", "/images/tracks/traralgon/master.webp"],
  ["Wagga", "/images/tracks/wagga/master.webp"],
  ["Warragul", "/images/tracks/warragul/master.webp"],
  ["Warrnambool", "/images/tracks/warrnambool/master.webp"],
  ["Wentworth Park", "/images/tracks/wentworth-park/master.webp"],
] as const;

assert.equal(expectedMediaPaths.length, 45);

for (const [trackName, expectedPath] of expectedMediaPaths) {
  assert.equal(trackMediaPathForName(trackName), expectedPath);
  assert.equal(
    existsSync(path.join(process.cwd(), "public", expectedPath)),
    true,
    `${trackName} is missing ${expectedPath}`
  );
}

assert.equal(
  trackMediaPathForName("  WENTWORTH   PARK "),
  "/images/tracks/wentworth-park/master.webp"
);

const aliases = [
  ["Townsville", "/images/tracks/townsville/master.webp"],
  ["Capalaba", "/images/tracks/capalaba/master.webp"],
  ["Rockhampton", "/images/tracks/rockhampton/master.webp"],
  ["The Gardens", "/images/tracks/ladbrokes-gardens/master.webp"],
  ["Q Straight", "/images/tracks/q-straight/master.webp"],
  ["Q1 Lakeside", "/images/tracks/q1-lakeside/master.webp"],
  ["Q2 Parklands", "/images/tracks/q2-parklands/master.webp"],
  ["The Meadows", "/images/tracks/the-meadows/master.webp"],
  ["Meadows (MEP)", "/images/tracks/the-meadows/master.webp"],
  ["Sandown Park", "/images/tracks/sandown-park/master.webp"],
  ["Sandown (SAP)", "/images/tracks/sandown-park/master.webp"],
  ["TABtouch Cannington", "/images/tracks/cannington/master.webp"],
] as const;

for (const [trackName, expectedPath] of aliases) {
  assert.equal(trackMediaPathForName(trackName), expectedPath);
}

assert.equal(trackMediaPathForName("Unknown Park"), null);

console.log("track media tests passed: 45 active tracks and aliases verified");
