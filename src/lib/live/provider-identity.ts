import { createHash } from "node:crypto";

export type ProviderEntityKind =
  | "dog"
  | "trainer"
  | "track"
  | "meeting"
  | "race"
  | "owner";

export function providerIdentityEvidenceSha256(
  provider: string,
  entityKind: ProviderEntityKind,
  sourceId: string,
  canonicalId: string,
) {
  return createHash("sha256")
    .update(`${provider}\n${entityKind}\n${sourceId}\n${canonicalId}`, "utf8")
    .digest("hex");
}

export function officialProviderProfileUrl(input: {
  provider: string;
  entityKind: ProviderEntityKind;
  sourceId: string;
  value?: string | null;
}) {
  if (!input.value || input.provider !== "thedogs") return null;
  try {
    const url = new URL(input.value, "https://www.thedogs.com.au");
    const expectedSegment = input.entityKind === "dog" ? "dogs" : "trainers";
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.thedogs.com.au" ||
      !url.pathname.startsWith(`/${expectedSegment}/${input.sourceId}/`)
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
