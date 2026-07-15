import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  NO_CUSTOM_CRYPTOGRAPHY_MASTER_EVIDENCE,
  NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID,
  REVIEWED_APPLICATION_ENCRYPTION_IMPLEMENTATIONS,
} from "./no-custom-cryptography-evidence";

const productionSources = sourceFiles("src").filter(
  (file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
);
const encryptionCallPattern =
  /\b(?:createCipheriv|createDecipheriv|createCipher|createDecipher|publicEncrypt|privateDecrypt)\s*\(|\.subtle\.(?:encrypt|decrypt)\s*\(/;
const encryptionFiles = productionSources.filter((file) =>
  encryptionCallPattern.test(readFileSync(file, "utf8")),
);
const reviewedFiles = REVIEWED_APPLICATION_ENCRYPTION_IMPLEMENTATIONS.map(
  ({ file }) => file,
);

assert.deepEqual(
  encryptionFiles,
  reviewedFiles,
  "every application encryption implementation requires explicit independent review",
);

const replaySource = readFileSync("src/lib/live/replay-proxy.ts", "utf8");
assert.match(replaySource, /hkdfSync\(\s*"sha256"/);
assert.match(replaySource, /REPLAY_PROXY_SECRET_MIN_BYTES = 32/);
assert.match(replaySource, /REPLAY_CAPABILITY_IV_BYTES = 12/);
assert.match(replaySource, /REPLAY_CAPABILITY_TAG_BYTES = 16/);
assert.match(replaySource, /randomBytes\(REPLAY_CAPABILITY_IV_BYTES\)/);
assert.equal(
  (replaySource.match(/createCipheriv\("aes-256-gcm"/g) ?? []).length,
  1,
);
assert.equal(
  (replaySource.match(/createDecipheriv\("aes-256-gcm"/g) ?? []).length,
  1,
);
assert.match(replaySource, /cipher\.setAAD\(REPLAY_CAPABILITY_AAD\)/);
assert.match(replaySource, /decipher\.setAAD\(REPLAY_CAPABILITY_AAD\)/);
assert.match(replaySource, /decipher\.setAuthTag\(tag\)/);
assert.doesNotMatch(replaySource, /\bcreate(?:Cipher|Decipher)\s*\(/);

assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID],
  NO_CUSTOM_CRYPTOGRAPHY_MASTER_EVIDENCE[
    NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID
  ],
);

console.log(
  `No-custom-cryptography control passed: ${encryptionFiles.length} application encryption implementation reviewed; AES-256-GCM, HKDF-SHA-256, random IV, AAD and authenticated-tag checks enforced.`,
);

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(relative(".", path).replaceAll("\\", "/"));
    }
  }
  return files.sort();
}
