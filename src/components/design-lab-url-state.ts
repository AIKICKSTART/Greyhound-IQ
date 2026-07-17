export const DESIGN_LAB_TRANSIENT_QUERY_KEYS = [
  "auditQuery",
  "workQuery",
] as const;

export function removeDesignLabTransientQueries(searchParams: URLSearchParams) {
  for (const key of DESIGN_LAB_TRANSIENT_QUERY_KEYS) {
    searchParams.delete(key);
  }
}
