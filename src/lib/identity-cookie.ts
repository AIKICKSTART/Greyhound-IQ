export const ACTIVE_IDENTITY_COOKIE = "giq-identity";
export const PERSONAL_IDENTITY = "personal";

export function resolveActiveIdentityCookie<Page extends { id: string }>(
  value: string | undefined,
  ownedPages: readonly Page[]
): { kind: "personal" } | { kind: "page"; page: Page } {
  if (!value || value === PERSONAL_IDENTITY) return { kind: "personal" };
  const page = ownedPages.find((candidate) => candidate.id === value);
  return page ? { kind: "page", page } : { kind: "personal" };
}
