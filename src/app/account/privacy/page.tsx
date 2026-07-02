import type { ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account privacy - GreyhoundIQ",
  description: "Review your GreyhoundIQ terms, consent, and marketing records.",
};

const PANEL_CLASS = "giq-panel p-6";
const ACTION_CLASS = "giq-outline-action";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZoneName: "short",
  year: "numeric",
});
const WITHHELD_SOURCE_LABEL = "Withheld";

type TermsAcceptanceRecord = {
  termsVersion: string;
  acceptedAt: Date;
  createdAt: Date;
};

type ConsentEventRecord = {
  consentType: string;
  action: string;
  version: string | null;
  source: string | null;
  occurredAt: Date;
  createdAt: Date;
};

type MarketingPreferenceRecord = {
  channel: string;
  optedIn: boolean;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrivacyRecords = {
  termsAcceptances: TermsAcceptanceRecord[];
  consentEvents: ConsentEventRecord[];
  marketingPreferences: MarketingPreferenceRecord[];
};

const EMPTY_PRIVACY_RECORDS: PrivacyRecords = {
  consentEvents: [],
  marketingPreferences: [],
  termsAcceptances: [],
};

export default async function AccountPrivacyPage() {
  const current = await requirePrivacyProfile();
  const records = await getPrivacyRecords(current.dbUserId);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Account
            <br />
            <span className="gradient-text">privacy.</span>
          </>
        }
        subtitle="Read-only privacy, consent, and communication records for your signed-in account."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        <div className="grid gap-6">
          <section className={PANEL_CLASS}>
            <div className="mb-5 flex items-center gap-3">
              <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Privacy records
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Terms versions"
                value={records.termsAcceptances.length}
              />
              <Metric
                label="Consent events"
                value={records.consentEvents.length}
              />
              <Metric
                label="Marketing channels"
                value={records.marketingPreferences.length}
              />
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <SectionHeader
              icon={<ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />}
              title="Terms acceptances"
            />
            {records.termsAcceptances.length > 0 ? (
              <TermsAcceptanceTable records={records.termsAcceptances} />
            ) : (
              <EmptyState label="No terms acceptances recorded." />
            )}
          </section>

          <section className={PANEL_CLASS}>
            <SectionHeader
              icon={<Clock className="h-5 w-5 text-[hsl(var(--secondary))]" />}
              title="Consent events"
            />
            {records.consentEvents.length > 0 ? (
              <ConsentEventTable records={records.consentEvents} />
            ) : (
              <EmptyState label="No consent events recorded." />
            )}
          </section>

          <section className={PANEL_CLASS}>
            <SectionHeader
              icon={<Database className="h-5 w-5 text-[hsl(var(--primary-bright))]" />}
              title="Marketing preferences"
            />
            {records.marketingPreferences.length > 0 ? (
              <MarketingPreferenceTable
                records={records.marketingPreferences}
              />
            ) : (
              <EmptyState label="No marketing preferences recorded." />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

async function requirePrivacyProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

async function getPrivacyRecords(userId: string): Promise<PrivacyRecords> {
  return safeQuery<PrivacyRecords>(
    async () => {
      const [termsAcceptances, consentEvents, marketingPreferences] =
        await Promise.all([
          prisma.termsAcceptance.findMany({
            orderBy: [{ acceptedAt: "desc" }],
            select: {
              acceptedAt: true,
              createdAt: true,
              termsVersion: true,
            },
            where: { userId },
          }),
          prisma.consentEvent.findMany({
            orderBy: [{ occurredAt: "desc" }],
            select: {
              action: true,
              consentType: true,
              createdAt: true,
              occurredAt: true,
              source: true,
              version: true,
            },
            where: { userId },
          }),
          prisma.marketingPreference.findMany({
            orderBy: [{ updatedAt: "desc" }],
            select: {
              channel: true,
              createdAt: true,
              optedIn: true,
              source: true,
              updatedAt: true,
            },
            where: { userId },
          }),
        ]);

      return {
        consentEvents,
        marketingPreferences,
        termsAcceptances,
      };
    },
    EMPTY_PRIVACY_RECORDS
  );
}

function TermsAcceptanceTable({
  records,
}: {
  records: TermsAcceptanceRecord[];
}) {
  return (
    <ResponsiveTable>
      <thead>
        <tr className="border-b border-white/[0.06] bg-white/[0.03] text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          <th className="px-4 py-3">Version</th>
          <th className="px-4 py-3">Accepted</th>
          <th className="px-4 py-3">Created</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr
            key={`${record.termsVersion}-${record.acceptedAt.toISOString()}-${index}`}
            className="border-b border-white/[0.05] last:border-0"
          >
            <td className="px-4 py-4 font-semibold text-[hsl(var(--foreground))]">
              {record.termsVersion}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatDateTime(record.acceptedAt)}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatDateTime(record.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

function ConsentEventTable({ records }: { records: ConsentEventRecord[] }) {
  return (
    <ResponsiveTable>
      <thead>
        <tr className="border-b border-white/[0.06] bg-white/[0.03] text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3">Action</th>
          <th className="px-4 py-3">Version</th>
          <th className="px-4 py-3">Source</th>
          <th className="px-4 py-3">Occurred</th>
          <th className="px-4 py-3">Created</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr
            key={`${record.consentType}-${record.action}-${record.occurredAt.toISOString()}-${index}`}
            className="border-b border-white/[0.05] last:border-0"
          >
            <td className="px-4 py-4 font-semibold text-[hsl(var(--foreground))]">
              {formatLabel(record.consentType)}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatLabel(record.action)}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {record.version ?? "Not recorded"}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatSource(record.source)}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatDateTime(record.occurredAt)}
            </td>
            <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
              {formatDateTime(record.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

function MarketingPreferenceTable({
  records,
}: {
  records: MarketingPreferenceRecord[];
}) {
  return (
    <ResponsiveTable>
      <thead>
        <tr className="border-b border-white/[0.06] bg-white/[0.03] text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          <th className="px-4 py-3">Channel</th>
          <th className="px-4 py-3">Opt-in status</th>
          <th className="px-4 py-3">Source</th>
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
              {formatSource(record.source)}
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
    </ResponsiveTable>
  );
}

function ResponsiveTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        {children}
      </table>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {icon}
      <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="giq-subpanel p-4">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="giq-dashed-panel p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        <Lock className="h-4 w-4" />
      </div>
      <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        {label}
      </p>
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

function formatDateTime(value: Date) {
  return DATE_TIME_FORMATTER.format(value);
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatSource(value: string | null) {
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
