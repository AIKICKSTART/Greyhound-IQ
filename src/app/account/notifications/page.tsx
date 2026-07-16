import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions";
import { requireCurrentUserProfile } from "@/lib/auth";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import { listNotificationsForUser } from "@/lib/notification-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account notifications - GreyhoundIQ",
  description: "Review your GreyhoundIQ marketing notification preferences.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS =
  "giq-outline-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";
const WITHHELD_SOURCE_LABEL = "Withheld";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "Australia/Sydney",
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

type NotificationRecord = Awaited<
  ReturnType<typeof listNotificationsForUser>
>[number];

export default async function AccountNotificationsPage() {
  const current = await requireNotificationsProfile();
  const [notifications, preferences] = await Promise.all([
    listNotificationsForUser(current.dbUserId),
    getMarketingPreferences(current),
  ]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
          <div className="max-w-2xl">
            <p className="program-label">Account settings</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
              Notifications
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
              Review in-app updates and your recorded communication preferences.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="giq-status-pill giq-status-pill-purple min-h-8 px-3">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {unreadCount} unread
            </span>
            <Link href="/account" className={ACTION_CLASS}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to account
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className={`${PANEL_CLASS} mb-6`}>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Bell className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
              In-app notifications
            </h2>
          </div>

          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead} className="mb-4">
              <button className={`${ACTION_CLASS} px-3 text-[12px]`}>
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </form>
          ) : null}

          {notifications.length > 0 ? (
            <NotificationList records={notifications} />
          ) : (
            <EmptyState label="No in-app notifications recorded." />
          )}
        </section>

        <section className={PANEL_CLASS}>
          <div className="mb-5 flex items-center gap-3">
            <Bell className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
              Marketing preferences
            </h2>
          </div>
          {preferences.length > 0 ? (
            <MarketingPreferenceTable records={preferences} />
          ) : (
            <EmptyState label="No marketing preferences recorded." />
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
  current: CurrentUserProfile
): Promise<MarketingPreferenceRecord[]> {
  return safeQuery(
    async () => {
      const rows = await withDbRequestContext(current, (tx) =>
        tx.marketingPreference.findMany({
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
          select: {
            channel: true,
            createdAt: true,
            optedIn: true,
            source: true,
            updatedAt: true,
          },
          where: { userId: current.dbUserId },
        })
      );

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

function NotificationList({ records }: { records: NotificationRecord[] }) {
  return (
    <div className="space-y-3">
      {records.map((record) => {
        const readAction = markNotificationRead.bind(null, record.id);
        return (
          <article
            key={record.id}
            className={`giq-subpanel p-4 sm:p-5 ${
              record.readAt ? "" : "border-[hsl(var(--primary-light)/0.28)]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`giq-status-pill ${
                      record.readAt ? "" : "giq-status-pill-purple"
                    }`}
                  >
                    {record.readAt ? "Read" : "Unread"}
                  </span>
                  <span className="text-[11px] uppercase text-[hsl(var(--subtle-foreground))]">
                    {formatLabel(record.type)}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                  {record.title}
                </h3>
                {record.body ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {record.body}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
                  {formatDateTime(record.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.href ? (
                  <Link
                    href={record.href}
                    className={`${ACTION_CLASS} px-3 text-[12px]`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Link>
                ) : null}
                {!record.readAt ? (
                  <form action={readAction}>
                    <button className={`${ACTION_CLASS} px-3 text-[12px]`}>
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark read
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MarketingPreferenceTable({
  records,
}: {
  records: MarketingPreferenceRecord[];
}) {
  return (
    <div
      className="giq-table-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
      role="region"
      aria-label="Scrollable marketing preference records"
      tabIndex={0}
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="giq-table-head">
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
              className="giq-table-row"
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
