import "server-only";

import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

// Read-only aggregates for the admin dashboard. Every block fails open to a
// null/empty fallback (via safeQuery) so one broken table cannot blank the
// whole overview.

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export type DailySeries = {
  /** ISO day labels (Sydney time), oldest first. */
  days: string[];
  values: number[];
  total: number;
};

export type AdminReporting = Awaited<ReturnType<typeof getAdminReporting>>;

const sydneyDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Buckets weighted timestamps into Sydney-local days over the trailing window.
function buildSeries(stamps: Array<{ at: Date; weight: number }>): DailySeries {
  const now = Date.now();
  const days: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    days.push(sydneyDay.format(new Date(now - i * DAY_MS)));
  }
  const index = new Map(days.map((day, i) => [day, i]));
  const values = days.map(() => 0);
  for (const { at, weight } of stamps) {
    const i = index.get(sydneyDay.format(at));
    if (i !== undefined) {
      values[i] += weight;
    }
  }
  return { days, values, total: values.reduce((sum, v) => sum + v, 0) };
}

export async function getAdminReporting() {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [series, breakdowns, queues, ops] = await Promise.all([
    safeQuery(
      () =>
        withDbSystemContext(async (tx) => {
          const [signups, payments] = await Promise.all([
            tx.user.findMany({
              where: { createdAt: { gte: since } },
              select: { createdAt: true },
            }),
            tx.paymentRecord.findMany({
              where: { status: "succeeded", occurredAt: { gte: since } },
              select: { occurredAt: true, amountCents: true },
            }),
          ]);
          return { signups, payments };
        }),
      null
    ),
    safeQuery(
      () =>
        withDbSystemContext(async (tx) => {
          const [listings, tiers] = await Promise.all([
            tx.listing.groupBy({ by: ["status"], _count: { _all: true } }),
            tx.user.groupBy({
              by: ["subscriptionTier"],
              _count: { _all: true },
            }),
          ]);
          return { listings, tiers };
        }),
      null
    ),
    safeQuery(
      () =>
        withDbSystemContext(async (tx) => {
          const [pendingOwnership, openSupport] = await Promise.all([
            tx.dogOwnership.count({ where: { status: "pending" } }),
            tx.supportTicket.count({ where: { status: "open" } }),
          ]);
          return { pendingOwnership, openSupport };
        }),
      null
    ),
    safeQuery(
      () =>
        withDbSystemContext(async (tx) => {
          const [sources, jobs, latestWebhook] = await Promise.all([
            tx.dataSourceHealth.findMany({
              orderBy: { sourceProvider: "asc" },
              select: {
                sourceProvider: true,
                status: true,
                lastSuccessAt: true,
                latencyMs: true,
              },
            }),
            tx.jobRun.findMany({
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                completedAt: true,
              },
            }),
            tx.webhookEvent.findFirst({
              orderBy: { receivedAt: "desc" },
              select: { receivedAt: true, status: true },
            }),
          ]);
          return { sources, jobs, latestWebhook };
        }),
      null
    ),
  ]);

  return {
    seriesAvailable: series !== null,
    signupsByDay: buildSeries(
      (series?.signups ?? []).map((row) => ({ at: row.createdAt, weight: 1 }))
    ),
    // ponytail: sums cents across currencies; fine while billing is AUD-only.
    revenueCentsByDay: buildSeries(
      (series?.payments ?? []).map((row) => ({
        at: row.occurredAt,
        weight: row.amountCents,
      }))
    ),
    listingsByStatus: (breakdowns?.listings ?? [])
      .map((row) => ({ label: row.status, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
    subscriptionTiers: (breakdowns?.tiers ?? [])
      .map((row) => ({ label: row.subscriptionTier, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
    pendingOwnership: queues?.pendingOwnership ?? null,
    openSupport: queues?.openSupport ?? null,
    sources: ops?.sources ?? [],
    recentJobs: ops?.jobs ?? [],
    latestWebhook: ops?.latestWebhook ?? null,
  };
}
