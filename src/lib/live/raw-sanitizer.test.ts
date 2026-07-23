import assert from "node:assert/strict";

import {
  sanitizeArchiveText,
  sanitizeArchiveValue,
  sanitizeProviderHtml,
  sanitizeRawJson,
  whitelistProviderSnapshot,
} from "./raw-sanitizer";

const sanitized = sanitizeArchiveValue({
  id: 1,
  startingPrice: 2.4,
  nested: {
    oddsFixedWin: 3.2,
    dividends: [2.1],
    prizeMoney: 1500,
  },
  sourceRawJson: JSON.stringify({ oddsToteWin: 4.8, resultTime: 30.1 }),
}) as Record<string, unknown>;

assert.deepEqual(sanitized, {
  id: 1,
  nested: { prizeMoney: 1500 },
  sourceRawJson: JSON.stringify({ resultTime: 30.1 }),
});

const html = `
  <tr>
    <td class="runner-form__time">30.10</td>
    <td class="runner-form__starting-price">$2.40</td>
    <th>SP</th>
  </tr>
`;
const cleanHtml = sanitizeProviderHtml(html);
assert.match(cleanHtml, /30\.10/);
assert.doesNotMatch(cleanHtml, /2\.40|starting-price|<th>SP<\/th>/i);

const raw = `${JSON.stringify({ startPrice: 2.4, resultPlace: 1 })}\n`;
const cleanRaw = sanitizeArchiveText(raw);
assert.equal(cleanRaw, `${JSON.stringify({ resultPlace: 1 })}\n`);
assert.equal(sanitizeArchiveText(cleanRaw), cleanRaw);
assert.equal(sanitizeRawJson(JSON.stringify({ bsp: 2.2, box: 1 })), JSON.stringify({ box: 1 }));

assert.equal(
  whitelistProviderSnapshot(
    JSON.stringify({
      id: 7,
      dogName: "Fast Hound",
      resultTime: 29.8,
      startingPrice: 2.1,
      futureProviderField: "must not persist",
    }),
    "watchdog",
    "runner"
  ),
  JSON.stringify({ id: 7, dogName: "Fast Hound", resultTime: 29.8 })
);
assert.equal(
  whitelistProviderSnapshot(
    JSON.stringify({
      href: "/races/1",
      prizePlaces: { first: 1000, odds: 2.5 },
      bookmakerPayload: { price: 2.5 },
    }),
    "thedogs",
    "race"
  ),
  JSON.stringify({ href: "/races/1", prizePlaces: { first: 1000 } })
);
assert.equal(
  whitelistProviderSnapshot(JSON.stringify({ id: 1 }), "unknown", "race"),
  null
);

console.log("raw odds sanitizer tests passed");
