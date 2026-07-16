const THEDOGS_ORIGIN = "https://www.thedogs.com.au";

type UnknownRecord = Record<string, unknown>;

export type TheDogsProfileArchiveIdentityResult = {
  verified: boolean;
  verificationStatus: "verified-exact-provider-page-identity" | "rejected-provider-page-identity";
  reasons: string[];
  pageDogIds: string[];
  observedProfilePaths: string[];
  embeddedIdentityProof: boolean;
};

export function verifyTheDogsProfileArchiveIdentity(
  fileSourceId: string,
  archiveValue: unknown,
): TheDogsProfileArchiveIdentityResult {
  const reasons: string[] = [];
  const archive = asRecord(archiveValue);
  const candidate = asRecord(archive?.candidate);
  const parsed = asRecord(archive?.parsed);
  const identityProof = asRecord(archive?.identityProof);
  const profileHtml = typeof archive?.profileHtml === "string" ? archive.profileHtml : "";

  if (!/^[0-9]+$/.test(fileSourceId)) reasons.push("file source id is not numeric");
  requireExactString(archive?.source, "thedogs", "archive source", reasons);
  requireExactString(archive?.sourceId, fileSourceId, "archive source id", reasons);
  requireExactString(candidate?.sourceId, fileSourceId, "candidate source id", reasons);
  requireExactString(parsed?.sourceProvider, "thedogs", "parsed source provider", reasons);
  requireExactString(parsed?.sourceId, fileSourceId, "parsed source id", reasons);
  requireRealEntityName(parsed?.name, "parsed dog name", reasons);
  requireParentIdentity(parsed?.sire, "parsed sire", reasons);
  requireParentIdentity(parsed?.dam, "parsed dam", reasons);

  requireBoundProfilePath(candidate?.profilePath, fileSourceId, "candidate profile path", reasons);
  requireBoundProfilePath(parsed?.profileUrl, fileSourceId, "parsed profile URL", reasons);
  if (archive?.showMorePath != null) {
    requireBoundFullFormPath(archive.showMorePath, fileSourceId, "show-more path", reasons);
  }

  const pageDogIds = profileHtml
    ? [...profileHtml.matchAll(/<blackbook-dog\b[^>]*\bdata-dog-id=["']([0-9]+)["'][^>]*>/gi)].map((match) => match[1])
    : [];
  const uniquePageDogIds = [...new Set(pageDogIds)].sort(compareNumericStrings);
  if (uniquePageDogIds.length === 0) {
    reasons.push("profile HTML has no provider dog identity");
  } else if (uniquePageDogIds.some((sourceId) => sourceId !== fileSourceId)) {
    reasons.push("profile HTML provider dog identity does not match file source id");
  }

  const observedProfilePaths = profileHtml
    ? [
        ...new Set(
          [...profileHtml.matchAll(/\/dogs\/([0-9]+)\/([^/"'<\s?]+)(?:\/full-form)?(?:\?[^"'<\s]*)?/gi)]
            .filter((match) => match[1] === fileSourceId)
            .map((match) => match[0].replace(/&amp;/gi, "&")),
        ),
      ].sort()
    : [];
  if (identityProof) {
    requireExactString(identityProof.requestedSourceId, fileSourceId, "embedded identity proof source id", reasons);
    requireExactString(
      identityProof.verificationStatus,
      "verified-exact-provider-page-identity",
      "embedded identity proof status",
      reasons,
    );
    if (identityProof.canonicalPromotionEligible !== false) {
      reasons.push("embedded identity proof must not grant canonical promotion");
    }
    const proofDogIds = Array.isArray(identityProof.pageDogIds)
      ? identityProof.pageDogIds.filter((value): value is string => typeof value === "string")
      : [];
    if (proofDogIds.length === 0 || proofDogIds.some((sourceId) => sourceId !== fileSourceId)) {
      reasons.push("embedded identity proof page dog ids do not bind file source id");
    }
    requireBoundProfilePath(
      identityProof.requestedProfilePath,
      fileSourceId,
      "embedded identity proof profile path",
      reasons,
    );
    if (identityProof.showMorePath != null) {
      requireBoundFullFormPath(
        identityProof.showMorePath,
        fileSourceId,
        "embedded identity proof full-form path",
        reasons,
      );
    }
  }

  return {
    verified: reasons.length === 0,
    verificationStatus:
      reasons.length === 0 ? "verified-exact-provider-page-identity" : "rejected-provider-page-identity",
    reasons,
    pageDogIds: uniquePageDogIds,
    observedProfilePaths,
    embeddedIdentityProof: Boolean(identityProof),
  };
}

function requireExactString(value: unknown, expected: string, label: string, reasons: string[]) {
  if (value !== expected) reasons.push(`${label} does not equal ${expected}`);
}

function requireParentIdentity(value: unknown, label: string, reasons: string[]) {
  if (value == null) return;
  const parent = asRecord(value);
  if (!parent) {
    reasons.push(`${label} is not an object`);
    return;
  }
  if (typeof parent.sourceId !== "string" || !/^[0-9]+$/.test(parent.sourceId)) {
    reasons.push(`${label} source id is not a numeric provider identity`);
  }
  requireRealEntityName(parent.name, `${label} name`, reasons);
}

function requireRealEntityName(value: unknown, label: string, reasons: string[]) {
  if (typeof value !== "string") {
    reasons.push(`${label} is missing`);
    return;
  }
  const name = value.trim();
  if (
    name.length === 0 ||
    name.length > 200 ||
    /^\d+$/.test(name) ||
    /^(?:unknown(?: runner| greyhound)?|n\/?a|none|null|placeholder|tbd|unnamed(?: dog| greyhound)?|vacant(?: box)?|scratched?|-+)$/i.test(name) ||
    /^(?:thedogs|watchdog|topaz|fasttrack(?:-prototype)?):\d+$/i.test(name)
  ) {
    reasons.push(`${label} is blank, placeholder, or provider-id text`);
  }
}

function requireBoundProfilePath(value: unknown, sourceId: string, label: string, reasons: string[]) {
  const url = parseTheDogsUrl(value);
  if (!url || !new RegExp(`^/dogs/${sourceId}/[^/?#]+$`, "i").test(url.pathname)) {
    reasons.push(`${label} does not bind exact provider source id ${sourceId}`);
  }
}

function requireBoundFullFormPath(value: unknown, sourceId: string, label: string, reasons: string[]) {
  const url = parseTheDogsUrl(value);
  if (!url || !new RegExp(`^/dogs/${sourceId}/[^/?#]+/full-form$`, "i").test(url.pathname)) {
    reasons.push(`${label} does not bind exact provider source id ${sourceId}`);
  }
}

function parseTheDogsUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value, THEDOGS_ORIGIN);
    return url.origin === THEDOGS_ORIGIN ? url : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function compareNumericStrings(left: string, right: string) {
  return Number(left) - Number(right) || left.localeCompare(right);
}
