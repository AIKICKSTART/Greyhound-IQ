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
      aria-label="Racing data source and freshness"
      data-racing-data-state={disclosure.state}
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        Loaded sources <strong>{disclosure.providerLabel}</strong>
      </span>
      <span>
        Latest accepted result{" "}
        {disclosure.latestResultAt ? (
          <time dateTime={disclosure.latestResultAt}>
            {disclosure.latestResultLabel}
          </time>
        ) : (
          <strong>{disclosure.latestResultLabel}</strong>
        )}
      </span>
      <span>
        Status checked{" "}
        <time dateTime={disclosure.checkedAt}>{disclosure.checkedAtLabel}</time>
      </span>
      <span className="giq-racing-data-disclosure-state">
        {disclosure.stateLabel}
      </span>
    </section>
  );
}
