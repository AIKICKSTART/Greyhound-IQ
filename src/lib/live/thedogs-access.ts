const THEDOGS_OWNED_REPLAY_HOSTS = new Set([
  "d2w8yyjcswa0zt.cloudfront.net",
  "mediatdogs.skyracing.com.au",
  "thedogs.com.au",
  "www.thedogs.com.au",
]);

export function isTheDogsLicensedUseApproved() {
  return process.env.THEDOGS_LICENSED_USE_APPROVED === "true";
}

export function assertTheDogsLicensedUseApproved() {
  if (!isTheDogsLicensedUseApproved()) {
    throw new Error("thedogs.licensed_use_not_approved");
  }
}

export function isTheDogsOwnedReplayHost(hostname: string) {
  return THEDOGS_OWNED_REPLAY_HOSTS.has(hostname.toLowerCase());
}
