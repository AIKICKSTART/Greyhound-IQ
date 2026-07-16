import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { effectiveAlignmentPreview } from "./media-alignment-upload";

assert.equal(
  effectiveAlignmentPreview("/current.webp", "blob:new-upload"),
  "blob:new-upload",
);
assert.equal(
  effectiveAlignmentPreview("/current.webp", null),
  "/current.webp",
);
assert.equal(effectiveAlignmentPreview(null, null), null);

const alignmentSource = readFileSync(
  join(__dirname, "media-alignment-upload.tsx"),
  "utf8",
);
const attachmentSource = readFileSync(
  join(__dirname, "media-attachment-fields.tsx"),
  "utf8",
);
assert.ok(
  alignmentSource.includes(
    "onPrimaryReadyPreviewChange={handleReadyPreview}",
  ) && alignmentSource.includes("pendingSrc ?? currentSrc"),
  "The alignment editor must switch from persisted media to a ready upload",
);
assert.ok(
  attachmentSource.includes('item.step === "done" && item.mediaId'),
  "Pending alignment must wait for an attachable media id",
);

console.log("media alignment upload tests passed");
