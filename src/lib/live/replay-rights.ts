import "server-only";

import providerRightsRegistry from "../../../config/provider-rights-authorizations.json";

import { isProviderRegistryUseAuthorized } from "@/lib/provider-rights";

import { proxiedStreamPath } from "./replay-proxy";

const AUSTRALIAN_JURISDICTIONS = new Set([
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
  "AUS",
]);

export function authorisedReplayStreamPath(input: {
  jurisdiction?: string | null;
  sourceProvider?: string | null;
  streamUrl?: string | null;
  now?: Date;
}) {
  if (!isReplayProxyAuthorised(input)) return null;
  return proxiedStreamPath(input.streamUrl, input.now?.getTime());
}

export function isReplayProxyAuthorised(input: {
  jurisdiction?: string | null;
  sourceProvider?: string | null;
  now?: Date;
}) {
  const sourceProvider = input.sourceProvider?.trim().toLowerCase();
  const jurisdiction = input.jurisdiction?.trim().toUpperCase() || "AUS";
  if (!sourceProvider || !AUSTRALIAN_JURISDICTIONS.has(jurisdiction)) {
    return false;
  }
  return isProviderRegistryUseAuthorized(
    providerRightsRegistry,
    {
      providerKey: sourceProvider,
      dataScope: "race-replays",
      jurisdiction,
      requiredPermissions: ["display", "replayRedistribution"],
    },
    input.now,
  );
}
