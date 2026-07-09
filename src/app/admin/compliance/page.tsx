import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireModeratorProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin compliance - GreyhoundIQ",
  description: "Read-only GreyhoundIQ consent and terms compliance overview.",
};

type TermsAcceptanceRow = {
  id: string;
  userId: string | null;
  termsVersion: string;
  acceptedAt: Date;
};

type ConsentEventRow = {
  id: string;
  userId: string | null;
  consentType: string;
  action: string;
  version: string | null;
  occurredAt: Date;
};

type MarketingPreferenceRow = {
  id: string;
  userId: string;
  channel: string;
  optedIn: boolean;
  updatedAt: Date;
};

type ComplianceData = {
  counts: {
    termsAcceptances: number | null;
    consentEvents: number | null;
    marketingPreferences: number | null;
    marketingOptIns: number | null;
    marketingOptOuts: number | null;
  };
  termsAcceptances: TermsAcceptanceRow[];
  consentEvents: ConsentEventRow[];
  marketingPreferences: MarketingPreferenceRow[];
};

export default async function AdminCompliancePage() {
  const current = await requireModeratorProfile();
  const data = await getComplianceData(current);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Compliance"
        description="Read-only terms acceptance, consent event, and marketing preference records. User emails, secrets, raw tokens, and provider payloads are not selected."
      />

      <section className="giq-panel p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Terms accepted"
            value={data.counts.termsAcceptances}
          />
          <MetricCard label="Consent events" value={data.counts.consentEvents} />
          <MetricCard
            label="Marketing prefs"
            value={data.counts.marketingPreferences}
          />
          <MetricCard label="Marketing opted in" value={data.counts.marketingOptIns} />
          <MetricCard
            label="Marketing opted out"
            value={data.counts.marketingOptOuts}
          />
        </div>
      </section>

      <AdminTable
        title="Latest terms acceptances"
        emptyLabel="No terms acceptance rows found."
        minWidth="min-w-[760px]"
        headers={["Row ID", "User ID", "Terms version", "Accepted"]}
        rows={data.termsAcceptances.map((row) => [
          row.id,
          row.userId ?? "No user",
          row.termsVersion,
          formatDateTime(row.acceptedAt),
        ])}
      />

      <AdminTable
        title="Latest consent events"
        emptyLabel="No consent event rows found."
        minWidth="min-w-[920px]"
        headers={["Row ID", "User ID", "Consent type", "Action", "Version", "Occurred"]}
        rows={data.consentEvents.map((row) => [
          row.id,
          row.userId ?? "No user",
          row.consentType,
          row.action,
          row.version ?? "No version",
          formatDateTime(row.occurredAt),
        ])}
      />

      <AdminTable
        title="Latest marketing preferences"
        emptyLabel="No marketing preference rows found."
        minWidth="min-w-[820px]"
        headers={["Row ID", "User ID", "Channel", "Opted in", "Updated"]}
        rows={data.marketingPreferences.map((row) => [
          row.id,
          row.userId,
          row.channel,
          formatBoolean(row.optedIn),
          formatDateTime(row.updatedAt),
        ])}
      />
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
        {formatCount(value)}
      </p>
    </div>
  );
}

function AdminTable({
  title,
  emptyLabel,
  minWidth,
  headers,
  rows,
}: {
  title: string;
  emptyLabel: string;
  minWidth: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="giq-panel mt-6 p-6">
      <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h2>
      <div className="giq-table-shell mt-4 overflow-x-auto">
        <table className={`w-full ${minWidth}`}>
          <thead>
            <tr className="giq-table-head">
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row[0]} className="border-t border-white/[0.06]">
                  {row.map((cell, index) => (
                    <td
                      key={`${row[0]}-${headers[index]}`}
                      className={
                        index < 2
                          ? "px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]"
                          : "px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function getComplianceData(
  current: CurrentUserProfile,
): Promise<ComplianceData> {
  const [
    termsAcceptances,
    consentEvents,
    marketingPreferences,
    marketingOptIns,
    marketingOptOuts,
    recentTermsAcceptances,
    recentConsentEvents,
    recentMarketingPreferences,
  ] = await Promise.all([
    countRows(() =>
      withDbRequestContext(current, (tx) => tx.termsAcceptance.count()),
    ),
    countRows(() =>
      withDbRequestContext(current, (tx) => tx.consentEvent.count()),
    ),
    countRows(() =>
      withDbRequestContext(current, (tx) => tx.marketingPreference.count()),
    ),
    countRows(() =>
      withDbRequestContext(current, (tx) =>
        tx.marketingPreference.count({ where: { optedIn: true } }),
      ),
    ),
    countRows(() =>
      withDbRequestContext(current, (tx) =>
        tx.marketingPreference.count({ where: { optedIn: false } }),
      ),
    ),
    getTermsAcceptances(current),
    getConsentEvents(current),
    getMarketingPreferences(current),
  ]);

  return {
    counts: {
      termsAcceptances,
      consentEvents,
      marketingPreferences,
      marketingOptIns,
      marketingOptOuts,
    },
    termsAcceptances: recentTermsAcceptances,
    consentEvents: recentConsentEvents,
    marketingPreferences: recentMarketingPreferences,
  };
}

function getTermsAcceptances(current: CurrentUserProfile) {
  return safeQuery<TermsAcceptanceRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.termsAcceptance.findMany({
          orderBy: { acceptedAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            termsVersion: true,
            acceptedAt: true,
          },
        }),
      ),
    []
  );
}

function getConsentEvents(current: CurrentUserProfile) {
  return safeQuery<ConsentEventRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.consentEvent.findMany({
          orderBy: { occurredAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            consentType: true,
            action: true,
            version: true,
            occurredAt: true,
          },
        }),
      ),
    []
  );
}

function getMarketingPreferences(current: CurrentUserProfile) {
  return safeQuery<MarketingPreferenceRow[]>(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.marketingPreference.findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            channel: true,
            optedIn: true,
            updatedAt: true,
          },
        }),
      ),
    []
  );
}

function countRows(fn: () => Promise<number>) {
  return safeQuery<number | null>(fn, null);
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
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
