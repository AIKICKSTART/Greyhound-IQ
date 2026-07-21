import { RefreshCw } from "lucide-react";

import { getLiveFeedStatus } from "@/lib/live/status";
import { buildRacingDataDisclosure } from "@/lib/racing-data-disclosure";
import { cached } from "@/lib/ttl-cache";

const PUBLIC_RACING_DISCLOSURE_TTL_MS = 60_000;

export async function RacingDataDisclosure({
  className = "",
}: {
  className?: string;
}) {
  const status = await cached(
    "public-racing-data-disclosure",
    PUBLIC_RACING_DISCLOSURE_TTL_MS,
    getLiveFeedStatus,
  );
  const disclosure = buildRacingDataDisclosure(status);

  return (
    <section
      className={`giq-racing-data-disclosure ${className}`.trim()}
      aria-label="Race data last updated"
      data-racing-data-state={disclosure.state}
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Data last updated</span>
      {disclosure.latestResultAt ? (
        <time dateTime={disclosure.latestResultAt}>
          {disclosure.latestResultLabel}
        </time>
      ) : (
        <strong>{disclosure.latestResultLabel}</strong>
      )}
      <span className="giq-racing-data-disclosure-state">
        {disclosure.state === "current"
          ? "Fresh · within 24h"
          : disclosure.state === "stale"
            ? "Delayed · over 24h"
            : "Freshness unavailable"}
      </span>
    </section>
  );
}
