import assert from "node:assert/strict";
import { sniffMatchesMimeType } from "./media-sniff";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

// Minimal real signatures for each family.
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37); // %PDF-1.7
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3);
const OGG = Uint8Array.from([..."OggS"].map((c) => c.charCodeAt(0)));
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00); // MZ (PE/DOS executable)

function riffWebp(): Uint8Array {
  const b = new Uint8Array(16);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
  return b;
}

function ftyp(brand: string): Uint8Array {
  const b = new Uint8Array(16);
  b.set([0x00, 0x00, 0x00, 0x18], 0); // box size
  b.set([..."ftyp"].map((c) => c.charCodeAt(0)), 4);
  b.set([...brand].map((c) => c.charCodeAt(0)), 8);
  return b;
}

// Reject: png bytes labeled image/jpeg.
assert.equal(sniffMatchesMimeType(PNG, "image/jpeg"), false, "png-as-jpeg rejected");

// Reject: exe bytes labeled image/jpeg.
assert.equal(sniffMatchesMimeType(EXE, "image/jpeg"), false, "exe-as-jpeg rejected");

// Reject: empty / unknown bytes.
assert.equal(sniffMatchesMimeType(bytes(0, 0, 0), "image/png"), false, "garbage rejected");

// Accept: correct pairs.
assert.equal(sniffMatchesMimeType(JPEG, "image/jpeg"), true, "jpeg accepted");
assert.equal(sniffMatchesMimeType(PNG, "image/png"), true, "png accepted");
assert.equal(sniffMatchesMimeType(PDF, "application/pdf"), true, "pdf accepted");
assert.equal(sniffMatchesMimeType(WEBM, "video/webm"), true, "webm accepted");
assert.equal(sniffMatchesMimeType(WEBM, "audio/webm"), true, "audio/webm accepted");
assert.equal(sniffMatchesMimeType(OGG, "audio/ogg"), true, "ogg accepted");
assert.equal(sniffMatchesMimeType(riffWebp(), "image/webp"), true, "webp accepted");
assert.equal(sniffMatchesMimeType(ftyp("mp42"), "video/mp4"), true, "mp4 accepted");
assert.equal(sniffMatchesMimeType(ftyp("qt  "), "video/quicktime"), true, "mov accepted");
assert.equal(sniffMatchesMimeType(ftyp("M4A "), "audio/mp4"), true, "m4a accepted");
assert.equal(sniffMatchesMimeType(ftyp("avif"), "image/avif"), true, "avif accepted");

// Cross-family: avif brand must not satisfy an mp4 claim, and vice versa.
assert.equal(sniffMatchesMimeType(ftyp("avif"), "video/mp4"), false, "avif-as-mp4 rejected");
assert.equal(sniffMatchesMimeType(ftyp("mp42"), "image/avif"), false, "mp4-as-avif rejected");

console.log("media-sniff tests passed");
