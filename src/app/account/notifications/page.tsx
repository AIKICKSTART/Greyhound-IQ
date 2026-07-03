import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account notifications - GreyhoundIQ",
  description: "Review your GreyhoundIQ marketing notification preferences.",
};

const PANEL_CLASS = "giq-panel p-6";
const ACTION_CLASS = "giq-outline-action";
const WITHHELD_SOURCE_LABEL = "Withheld";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZoneName: "short",
  year: "numeric",
});

type MarketingPreferenceRecord = {
  channel: string;
  optedIn: boolean;
  sourceLabel: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AccountNotificationsPage() {
  const current = await requireNotificationsProfile();
  const preferences = await getMarketingPreferences(current.dbUserId);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">notifications.</span>
          </>
        }
        subtitle="Read-only marketing notification preferences for your signed-in account."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        <section className={PANEL_CLASS}>
          <div className="mb-5 flex items-center gap-3">
            <Bell className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              Marketing preferences
            </h2>
          </div>

          {preferences.length > 0 ? (
            <MarketingPreferenceTable records={preferences} />
          ) : (
            <EmptyState />
          )}
        </section>
      </section>
    </div>
  );
}

async function requireNotificationsProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

function getMarketingPreferences(
  userId: string
): Promise<MarketingPreferenceRecord[]> {
  return safeQuery(
    async () => {
      const rows = await prisma.marketingPreference.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          channel: true,
          createdAt: true,
          optedIn: true,
          source: true,
          updatedAt: true,
        },
        where: { userId },
      });

      return rows.map((row) => ({
        channel: row.channel,
        createdAt: row.createdAt,
        optedIn: row.optedIn,
        sourceLabel: formatSourceLabel(row.source),
        updatedAt: row.updatedAt,
      }));
    },
    []
  );
}

function MarketingPreferenceTable({
  records,
}: {
  records: MarketingPreferenceRecord[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.03] text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Opt-in status</th>
            <th className="px-4 py-3">Source label</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              key={`${record.channel}-${record.updatedAt.toISOString()}-${index}`}
              className="border-b border-white/[0.05] last:border-0"
            >
              <td className="px-4 py-4 font-semibold text-[hsl(var(--foreground))]">
                {formatLabel(record.channel)}
              </td>
              <td className="px-4 py-4">
                <PreferenceStatus optedIn={record.optedIn} />
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {record.sourceLabel}
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatDateTime(record.createdAt)}
              </td>
              <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                {formatDateTime(record.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreferenceStatus({ optedIn }: { optedIn: boolean }) {
  return (
    <span className="giq-status-pill giq-status-pill-purple">
      {optedIn ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {optedIn ? "Opted in" : "Opted out"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="giq-dashed-panel p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        <Lock className="h-4 w-4" />
      </div>
      <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        No marketing preferences recorded.
      </p>
    </div>
  );
}

function formatDateTime(value: Date) {
  return DATE_TIME_FORMATTER.format(value);
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatSourceLabel(value: string | null) {
  const source = value?.trim().replace(/\s+/g, " ");
  if (!source) return "Not recorded";
  return isSafeSourceLabel(source) ? formatLabel(source) : WITHHELD_SOURCE_LABEL;
}

function isSafeSourceLabel(value: string) {
  const lower = value.toLowerCase();
  return (
    value.length <= 48 &&
    !/[@\\/]|https?:/i.test(value) &&
    !/\b(bearer|key|password|secret|session|token|user[-_ ]?id|workos)\b/.test(
      lower
    ) &&
    !/[A-Za-z0-9_-]{24,}/.test(value)
  );
}
