import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");
const start = source.indexOf("function MessageAttachment");
const end = source.indexOf("\nfunction SignedOutThread", start);

assert.ok(
  start >= 0 && end > start,
  "Pulse must keep a bounded media renderer",
);
const renderer = source.slice(start, end);

assert.ok(
  source.includes(
    'import { ProcessedVideo } from "@/components/processed-video"',
  ),
  "Pulse video must reuse the shared HLS/MP4 player",
);
for (const mediaKind of ["image/", "video/", "audio/"]) {
  assert.ok(
    renderer.includes(mediaKind),
    `Pulse must preview ${mediaKind} media`,
  );
}
for (const variant of ["playback", "hls", "poster", "caption"]) {
  assert.ok(
    renderer.includes(`?variant=${variant}`),
    `Pulse must request the authorized ${variant} variant`,
  );
}
for (const status of [
  "Scanning attachment…",
  "Attachment removed by safety scan",
  "Attachment processing failed",
  "Preparing attachment…",
]) {
  assert.ok(renderer.includes(status), `Pulse must render ${status}`);
}
assert.ok(
  source.includes("(realtimeChannel || hasPendingMessageMedia)"),
  "pending attachments must keep polling when Realtime is unavailable",
);
assert.ok(
  source.includes("realtimeChannel") && source.includes(": []"),
  "the full thread must allow polling without a Realtime channel",
);

console.log("Pulse message attachment parity tests passed");
