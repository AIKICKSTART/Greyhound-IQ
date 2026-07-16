import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  mediaUploadSubmissionMessage,
  setFormUploadBlocked,
} from "./media-attachment-fields";

assert.equal(mediaUploadSubmissionMessage([]), null);
assert.equal(mediaUploadSubmissionMessage(["done"]), null);
assert.equal(
  mediaUploadSubmissionMessage(["signing"]),
  "Wait for the media upload to finish before saving.",
  "Selecting a file must block an immediate form submission before signing finishes",
);
assert.equal(
  mediaUploadSubmissionMessage(["done", "finalizing"]),
  "Wait for the media upload to finish before saving.",
);
assert.equal(
  mediaUploadSubmissionMessage(["error"]),
  "Retry or remove the failed upload before saving.",
);

const initiallyEnabled = { disabled: false };
const initiallyDisabled = { disabled: true };
const controls = [initiallyEnabled, initiallyDisabled];
const form = {
  querySelectorAll: () => controls,
} as unknown as HTMLFormElement;
const avatarUpload = Symbol("avatar-upload");
const coverUpload = Symbol("cover-upload");

setFormUploadBlocked(form, avatarUpload, true);
setFormUploadBlocked(form, coverUpload, true);
assert.equal(initiallyEnabled.disabled, true);
assert.equal(initiallyDisabled.disabled, true);

setFormUploadBlocked(form, avatarUpload, false);
assert.equal(
  initiallyEnabled.disabled,
  true,
  "Completing one upload must not re-enable Save while another upload is active",
);

setFormUploadBlocked(form, coverUpload, false);
assert.equal(initiallyEnabled.disabled, false);
assert.equal(
  initiallyDisabled.disabled,
  true,
  "Every submit control must regain its original disabled state",
);

const source = readFileSync(
  join(__dirname, "media-attachment-fields.tsx"),
  "utf8",
);
assert.ok(
  source.includes('rootRef.current?.closest("form")') &&
    source.includes('form.addEventListener("submit", blockSubmission, true)') &&
    source.includes("event.preventDefault()"),
  "The upload guard must block only its nearest enclosing form",
);
assert.ok(
  source.includes("disabledBefore.set(control, control.disabled)") &&
    source.includes("control.disabled = wasDisabled"),
  "The upload guard must restore each submit control's prior disabled state",
);
assert.ok(
  source.includes('item.step === "done" && item.mediaId'),
  "Only finalized media IDs may be submitted",
);

console.log("media attachment form guard tests passed");
