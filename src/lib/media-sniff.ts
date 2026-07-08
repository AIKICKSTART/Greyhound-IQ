import type { MediaMimeType } from "@/lib/media-validation";

// Magic-byte sniffing for the allowlisted media types only. We verify the
// stored bytes match the *family* the client claimed (image/video/audio/pdf),
// not the exact codec — the byte signatures below can't distinguish, e.g.,
// audio/mp4 from video/mp4 (both are ISO-BMFF `ftyp`), and that's fine: the
// point is to reject a file whose real contents don't match its declared type
// (an .exe uploaded as image/jpeg), not to police container sub-types.

type Family = "image/jpeg" | "image/png" | "image/webp" | "image/avif"
  | "isobmff" | "video/webm" | "audio/ogg" | "application/pdf";

// Maps each allowlisted MIME type to the byte-signature family it must match.
// mp4/quicktime (video and audio) all share the ISO-BMFF `ftyp` box.
const MIME_FAMILY: Record<MediaMimeType, Family> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/avif": "image/avif",
  "video/mp4": "isobmff",
  "video/webm": "video/webm",
  "video/quicktime": "isobmff",
  "audio/mp4": "isobmff",
  "audio/webm": "video/webm",
  "audio/ogg": "audio/ogg",
  "application/pdf": "application/pdf",
};

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  return startsWith(bytes, [...text].map((c) => c.charCodeAt(0)), offset);
}

function detectFamily(bytes: Uint8Array): Family | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm"; // EBML (webm/mkv)
  if (asciiAt(bytes, 0, "OggS")) return "audio/ogg";

  // RIFF containers: bytes 0-3 "RIFF", bytes 8-11 the form type.
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) return "image/webp";

  // ISO base media (mp4/mov/avif): size(4) + "ftyp" at offset 4, brand at 8.
  if (asciiAt(bytes, 4, "ftyp")) {
    const brand =
      asciiAt(bytes, 8, "avif") || asciiAt(bytes, 8, "avis") ? "image/avif" : "isobmff";
    return brand;
  }

  return null;
}

/**
 * Verifies the leading bytes of a stored object match the client-claimed MIME
 * type's signature family. Returns true only when the real contents are
 * consistent with the declared type. Pure — pass the first ~4KB of the object.
 */
export function sniffMatchesMimeType(
  bytes: Uint8Array,
  claimedMimeType: MediaMimeType
): boolean {
  const expected = MIME_FAMILY[claimedMimeType];
  const detected = detectFamily(bytes);
  if (detected === null) return false;
  // avif is an ISO-BMFF brand; a plain isobmff detection is acceptable for it
  // only when the claim itself is isobmff. Keep the check strict per family.
  return detected === expected;
}
