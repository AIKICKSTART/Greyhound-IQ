import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { AdminSubmitButton } from "@/app/admin/admin-submit-button";
import { StatusPill } from "@/components/admin/status-pill";
import {
  createBannedPhrase,
  resolveTrustSafetyFlag,
  setBannedPhraseActive,
} from "@/app/actions";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";
import {
  listBannedPhrasesForModerator,
  listTrustSafetyFlagsForModerator,
} from "@/lib/moderation-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trust and safety - GreyhoundIQ",
  description: "GreyhoundIQ trust and safety moderation controls.",
};

export default async function AdminSafetyPage() {
  await requireModeratorProfile();
  const [phrases, flags, metrics] = await Promise.all([
    listBannedPhrasesForModerator(),
    listTrustSafetyFlagsForModerator(),
    getSafetyMetrics(),
  ]);
  const openFlags = flags.filter((flag) => flag.status === "open").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <AdminPageHeader
        title="Moderation controls"
        description="Manage proactive content rules and resolve trust and safety signals. Every control remains restricted to moderators."
      />

      <section className="giq-panel p-4 sm:p-6" aria-labelledby="safety-overview-heading">
        <div>
          <h2
            id="safety-overview-heading"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            Safety overview
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Current review demand and enforcement signals across member content.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="giq-metric-card">
              <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                {metric.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
                {formatCount(metric.value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="giq-panel p-4 sm:p-5" aria-labelledby="banned-phrases-heading">
          <h2
            id="banned-phrases-heading"
            className="text-xl font-semibold text-[hsl(var(--foreground))]"
          >
            Add a content rule
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Match a phrase across selected member-generated content and choose whether to
            review or block it.
          </p>
          <form action={createBannedPhrase} className="mt-4 space-y-3">
            <label className="grid gap-1.5 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
              Phrase
              <input
                name="phrase"
                required
                minLength={2}
                maxLength={120}
                placeholder="Phrase"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
              />
            </label>
            <label className="grid gap-1.5 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
              Content surface
              <select
                name="target"
                defaultValue="all"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
              >
                <option value="all">All UGC</option>
                <option value="listing">Marketplace</option>
                <option value="feed">Feed</option>
                <option value="message">Pulse</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
              Moderation action
              <select
                name="action"
                defaultValue="review"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
              >
                <option value="review">Route to review</option>
                <option value="block">Block submit</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
              <span>
                Reason{" "}
                <span className="font-normal text-[hsl(var(--subtle-foreground))]">
                  Optional
                </span>
              </span>
              <input
                name="reason"
                maxLength={500}
                placeholder="Moderation context"
                className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
              />
            </label>
            <AdminSubmitButton
              label="Save phrase"
              pendingLabel="Saving…"
              className="giq-button giq-button-primary min-h-11 w-full px-4 text-[13px]"
            />
          </form>
        </section>

        <section className="giq-panel p-4 sm:p-5" aria-labelledby="active-rules-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="active-rules-heading"
                className="text-xl font-semibold text-[hsl(var(--foreground))]"
              >
                Content rules
              </h2>
              <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                Activate or pause phrase matching without deleting rule history.
              </p>
            </div>
            <span className="giq-badge giq-badge-neutral">{phrases.length} rules</span>
          </div>
          <div className="mt-4 space-y-3">
            {phrases.length === 0 ? (
              <div className="giq-empty-state p-6 text-center">
                <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                  No content rules configured
                </p>
                <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                  Add a phrase to begin proactive moderation.
                </p>
              </div>
            ) : (
              phrases.map((phrase) => (
                <div key={phrase.id} className="giq-subpanel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[13px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
                        {phrase.phrase}
                      </p>
                      <p className="mt-1 text-[11px] uppercase text-[hsl(var(--subtle-foreground))]">
                        {phrase.target} · {phrase.action}
                      </p>
                    </div>
                    <span className="giq-badge giq-badge-neutral">
                      {phrase.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {phrase.reason ? (
                    <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                      {phrase.reason}
                    </p>
                  ) : null}
                  <form
                    action={setBannedPhraseActive.bind(
                      null,
                      phrase.id,
                      !phrase.active
                    )}
                    className="mt-3"
                  >
                    <AdminSubmitButton
                      label={phrase.active ? "Deactivate" : "Activate"}
                      pendingLabel="Updating…"
                      confirmMessage={`${phrase.active ? "Deactivate" : "Activate"} this content rule?`}
                      className="giq-outline-action min-h-11 px-3 text-[12px]"
                    />
                  </form>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section
        className="giq-panel mt-6 p-4 sm:p-5"
        aria-labelledby="trust-safety-flags-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="trust-safety-flags-heading"
              className="text-xl font-semibold text-[hsl(var(--foreground))]"
            >
              Trust and safety flags
            </h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Inspect current signals and close them once the moderation response is complete.
            </p>
          </div>
          <span className="giq-badge giq-badge-gold" aria-label={`${openFlags} open safety flags`}>
            {openFlags} open
          </span>
        </div>
        <div
          className="giq-table-shell mt-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
          role="region"
          aria-label="Trust and safety flags"
          tabIndex={0}
        >
          <table className="w-full min-w-[920px]">
            <caption className="sr-only">
              Trust and safety flags with resolution controls
            </caption>
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Flag</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No trust and safety flags are waiting for review.
                  </td>
                </tr>
              ) : (
                flags.map((flag) => (
                  <tr
                    key={flag.id}
                    className="border-t border-white/[0.06] align-top transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                        {flag.flagType}
                      </p>
                      <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                        {flag.reason}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))] [overflow-wrap:anywhere]">
                      {flag.targetType}:{flag.targetId}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={flag.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={flag.status} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(flag.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {flag.status === "open" ? (
                        <form action={resolveTrustSafetyFlag.bind(null, flag.id)}>
                          <AdminSubmitButton
                            label="Resolve"
                            pendingLabel="Resolving…"
                            confirmMessage="Resolve this trust and safety flag?"
                            className="giq-outline-action min-h-11 px-3 text-[12px]"
                          />
                        </form>
                      ) : (
                        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
                          Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

async function getSafetyMetrics() {
  const [
    pendingReviews,
    openReports,
    takedowns,
    repeatOffenders,
    uploadFailures,
    openFlags,
  ] = await Promise.all([
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.listing.count({ where: { status: "pending_review" } })
      )
    ),
    countRows(() =>
      withDbSystemContext((tx) => tx.report.count({ where: { status: "open" } }))
    ),
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.listingModerationAction.count({
          where: { action: { in: ["listing.reject", "listing.remove"] } },
        })
      )
    ),
    countRepeatOffenders(),
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.mediaAsset.count({ where: { scanStatus: { in: ["infected", "error"] } } })
      )
    ),
    countRows(() =>
      withDbSystemContext((tx) =>
        tx.trustSafetyFlag.count({ where: { status: "open" } })
      )
    ),
  ]);

  return [
    { label: "Pending reviews", value: pendingReviews },
    { label: "Open reports", value: openReports },
    { label: "Takedowns", value: takedowns },
    { label: "Repeat offenders", value: repeatOffenders },
    { label: "Upload failures", value: uploadFailures },
    { label: "Open safety flags", value: openFlags },
  ];
}

function countRows(fn: () => Promise<number>) {
  return safeQuery<number | null>(fn, null);
}

async function countRepeatOffenders() {
  return safeQuery<number | null>(
    () =>
      withDbSystemContext(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM (
            SELECT "reportedId"
            FROM "Report"
            WHERE "reportedId" IS NOT NULL
            GROUP BY "reportedId"
            HAVING COUNT(*) >= 2
          ) AS "repeatOffenders"
        `;
        return Number(rows[0]?.count ?? 0);
      }),
    null
  );
}

function formatCount(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString("en-AU");
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
