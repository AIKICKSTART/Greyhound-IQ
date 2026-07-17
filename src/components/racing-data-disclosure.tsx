import { Database, RefreshCw } from "lucide-react";

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
      <div className="giq-racing-data-disclosure-title">
        <Database className="h-4 w-4" aria-hidden="true" />
        <span>Data provenance</span>
      </div>
      <dl>
        <div>
          <dt>Loaded sources</dt>
          <dd>{disclosure.providerLabel}</dd>
        </div>
        <div>
          <dt>Latest accepted result</dt>
          <dd>
            {disclosure.latestResultAt ? (
              <time dateTime={disclosure.latestResultAt}>
                {disclosure.latestResultLabel}
              </time>
            ) : (
              disclosure.latestResultLabel
            )}
          </dd>
        </div>
        <div>
          <dt>Status checked</dt>
          <dd>
            <time dateTime={disclosure.checkedAt}>
              {disclosure.checkedAtLabel}
            </time>
          </dd>
        </div>
      </dl>
      <p className="giq-racing-data-disclosure-state">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {disclosure.stateLabel}
      </p>
    </section>
  );
}
