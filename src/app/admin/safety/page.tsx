import { AdminPageHeader } from "@/app/admin/admin-page-header";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader title="Moderation controls" />

      <section className="giq-panel p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="giq-panel p-5">
          <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Banned phrases
          </h2>
          <form action={createBannedPhrase} className="mt-4 space-y-3">
            <input
              name="phrase"
              required
              minLength={2}
              maxLength={120}
              placeholder="Phrase"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            />
            <select
              name="target"
              defaultValue="all"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            >
              <option value="all">All UGC</option>
              <option value="listing">Marketplace</option>
              <option value="feed">Feed</option>
              <option value="message">Pulse</option>
            </select>
            <select
              name="action"
              defaultValue="review"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            >
              <option value="review">Route to review</option>
              <option value="block">Block submit</option>
            </select>
            <input
              name="reason"
              maxLength={500}
              placeholder="Reason optional"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            />
            <button className="giq-button giq-button-primary px-4 text-[13px]">
              Save phrase
            </button>
          </form>
        </section>

        <section className="giq-panel p-5">
          <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Active rules
          </h2>
          <div className="mt-4 space-y-3">
            {phrases.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No banned phrases configured.
              </p>
            ) : (
              phrases.map((phrase) => (
                <div key={phrase.id} className="giq-subpanel p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[13px] text-[hsl(var(--foreground))]">
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
                    <button className="giq-outline-action min-h-8 px-3 text-[12px]">
                      {phrase.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="giq-panel mt-6 p-5">
        <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
          Trust and safety flags
        </h2>
        <div className="giq-table-shell mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px]">
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
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No trust and safety flags.
                  </td>
                </tr>
              ) : (
                flags.map((flag) => (
                  <tr key={flag.id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                        {flag.flagType}
                      </p>
                      <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                        {flag.reason}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
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
                          <button className="giq-outline-action min-h-8 px-3 text-[12px]">
                            Resolve
                          </button>
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
        const rows = await tx.report.groupBy({
          by: ["reportedId"],
          where: { reportedId: { not: null } },
          _count: { _all: true },
        });
        return rows.filter((row) => row._count._all >= 2).length;
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
