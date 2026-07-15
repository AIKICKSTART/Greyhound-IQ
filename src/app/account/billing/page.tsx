import type { Prisma } from "@prisma/client";
import {
  ArrowLeft,
  CalendarClock,
  CreditCard,
  FileText,
  Gauge,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHero } from "@/components/page-hero";
import { RateLimitRecoveryCard } from "@/components/rate-limit-recovery-card";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlementLimitsForCurrentUser } from "@/lib/billing/entitlement-service";
import type {
  EntitlementKey,
  EntitlementLimits,
} from "@/lib/billing/entitlements";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext, type DbContextUser } from "@/lib/db-context";
import { BILLING_RATE_LIMIT_RECOVERY_SECONDS } from "@/lib/rate-limit-recovery";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing - GreyhoundIQ",
  description:
    "Review your GreyhoundIQ plan, billing status, invoices, and entitlement limits.",
};

const PANEL_CLASS = "giq-panel p-5 sm:p-6";
const ACTION_CLASS = "giq-outline-action";
const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
} as const;
const ENTITLEMENT_SUMMARY: { key: EntitlementKey; label: string }[] = [
  { key: "race_detail_views_per_month", label: "Race views" },
  { key: "prediction_runs_per_month", label: "Predictions" },
  { key: "agent_runs_per_month", label: "Agent runs" },
  { key: "storage_bytes", label: "Storage" },
  { key: "retention_days", label: "Retention" },
];
const STATUS_BANNER_TONE_CLASS = {
  danger: "border-rose-400/30 bg-rose-400/[0.08]",
  neutral: "border-white/[0.08] bg-white/[0.03]",
  ok: "border-emerald-400/25 bg-emerald-400/[0.07]",
  warning: "border-amber-300/30 bg-amber-300/[0.08]",
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  timeZone: "Australia/Sydney",
  year: "numeric",
});

type BillingUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type BillingPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const user = await getCurrentUser();
  const query = await searchParams;

  return (
    <div>
      {user ? (
        <BillingMemberHeader tier={user.tier} />
      ) : (
        <PageHero
          image="/images/feature-pricing-product.webp"
          title={
            <>
              Account
              <br />
              <span className="gradient-text">billing.</span>
            </>
          }
          subtitle="Plan, billing status, invoices, and entitlement limits for your account."
        />
      )}

      <section
        className={
          user
            ? "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
            : "mx-auto max-w-5xl px-6 py-12"
        }
      >
        <BillingOutcomeBanner query={query} />
        {user ? (
          <SignedInBilling user={user} />
        ) : (
          <>
            <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to account
            </Link>
            <SignedOutBilling />
          </>
        )}
      </section>
    </div>
  );
}

function BillingOutcomeBanner({
  query,
}: {
  query: { [key: string]: string | string[] | undefined };
}) {
  const checkout = singleQueryValue(query.checkout);
  const portal = singleQueryValue(query.portal);
  const billing = singleQueryValue(query.billing);
  const interval =
    query.interval === "monthly" || query.interval === "yearly"
      ? query.interval
      : null;

  if (checkout === "success") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Returned from Stripe Checkout
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {query.plan === "pro"
            ? `Your Pro${interval ? ` ${interval}` : ""} checkout return was received. `
            : "Your checkout return was received. "}
          The local plan only changes after the signed Stripe webhook is
          verified, which may take a moment.
        </p>
        <Link href="/account/billing" className={`${ACTION_CLASS} mt-3 w-fit`}>
          Refresh billing status
        </Link>
      </div>
    );
  }

  if (checkout === "cancelled") {
    const retryQuery = new URLSearchParams({ checkout: "cancelled" });
    if (query.plan === "pro") retryQuery.set("plan", "pro");
    if (interval) retryQuery.set("interval", interval);
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-amber-300/30 bg-amber-300/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Checkout cancelled — no plan change was made
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Your current tier is unchanged. Return to pricing to retry securely.
        </p>
        <Link
          href={`/pricing?${retryQuery.toString()}`}
          className={`${ACTION_CLASS} mt-3 w-fit`}
        >
          Retry checkout
        </Link>
      </div>
    );
  }

  if (billing === "failed") {
    return (
      <div
        role="alert"
        className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Secure billing portal could not be opened
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Your subscription and payment method were not changed. Retry the
          secure Stripe portal when you are ready.
        </p>
        <BillingPortalAction className="mt-3">
          Retry secure billing portal
        </BillingPortalAction>
      </div>
    );
  }

  if (billing === "rate-limited") {
    return (
      <div className="mb-6">
        <RateLimitRecoveryCard
          title="Billing portal paused briefly"
          detail="We limited repeated portal attempts to protect your account. Your subscription and payment method were not changed."
          retryAfterSeconds={BILLING_RATE_LIMIT_RECOVERY_SECONDS}
          action={
            <BillingPortalAction>Retry secure billing portal</BillingPortalAction>
          }
        />
      </div>
    );
  }

  if (portal === "returned") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Returned from the secure Stripe billing portal
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Any subscription or payment-method changes may take a moment to appear
          while the signed webhook updates this read-only snapshot.
        </p>
      </div>
    );
  }

  if (portal === "no_customer" || billing === "not_started") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          No Stripe billing profile yet
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Start a paid plan before opening the billing portal.
        </p>
        <Link href="/pricing" className={`${ACTION_CLASS} mt-3 w-fit`}>
          View plans
        </Link>
      </div>
    );
  }

  return null;
}

function BillingPortalAction({
  children,
  className = "",
  showIcon = false,
}: {
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <form action="/api/billing/portal" method="post" className={className}>
      <button type="submit" className={`${ACTION_CLASS} w-full sm:w-auto`}>
        {showIcon ? (
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    </form>
  );
}

function singleQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function BillingMemberHeader({ tier }: { tier: BillingUser["tier"] }) {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
            Billing
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Review your plan, billing status, invoices, and account limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="giq-status-pill giq-status-pill-purple min-h-8 px-3"
            aria-label={`Current tier ${PLAN_LABELS[tier]}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {PLAN_LABELS[tier]}
          </span>
          <Link href="/account" className={ACTION_CLASS}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to account
          </Link>
        </div>
      </div>
    </header>
  );
}

async function SignedInBilling({ user }: { user: BillingUser }) {
  const overview = await getLocalBillingOverview(user);
  const planCode = overview.subscription?.planCode ?? user.tier;
  const hasPaidTier = user.tier !== "free";
  const status = overview.subscription
    ? formatSnapshotText(overview.subscription.status)
    : hasPaidTier
      ? "Active"
      : "No subscription";

  return (
    <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
      <section className={`${PANEL_CLASS} lg:col-span-5`}>
        <div className="mb-5 flex items-center gap-3">
          <CreditCard
            className="h-5 w-5 text-[hsl(var(--secondary))]"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Plan
          </h2>
        </div>

        {overview.subscription ? (
          <SubscriptionStatusBanner
            currentPeriodEnd={overview.subscription.currentPeriodEnd}
            status={overview.subscription.status}
            updatedAt={overview.subscription.updatedAt}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Plan" value={formatPlanCode(planCode)} />
          <Metric label="Status" value={status} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <BillingPortalAction
            className="w-full sm:w-auto"
            showIcon
          >
            Manage billing
          </BillingPortalAction>
          <Link href="/pricing" className={`${ACTION_CLASS} w-full sm:w-auto`}>
            Change plan
          </Link>
        </div>

        {overview.subscription ? (
          <div className="giq-subpanel mt-5 grid gap-3 p-4 text-[13px]">
            <InfoRow
              label="Current period"
              value={`${formatDate(
                overview.subscription.currentPeriodStart
              )} to ${formatDate(overview.subscription.currentPeriodEnd)}`}
            />
            <InfoRow
              label="Started"
              value={formatDate(overview.subscription.startedAt)}
            />
            <InfoRow
              label="Last updated"
              value={formatDate(overview.subscription.updatedAt)}
            />
          </div>
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-4 w-4" />}
            title={hasPaidTier ? "Stripe billing active" : "No subscription snapshot"}
            body={
              hasPaidTier
                ? "Your paid tier is active. Use Manage billing for subscription details, invoices, and cancellation."
                : "Your account is using the free tier defaults until a paid subscription is started."
            }
          />
        )}
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-7`}>
        <div className="mb-5 flex items-center gap-3">
          <Gauge
            className="h-5 w-5 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Entitlements
          </h2>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="giq-status-pill giq-status-pill-purple">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {overview.entitlementSnapshot ? "Local snapshot" : "Tier defaults"}
          </span>
          <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Effective {formatDate(overview.entitlementSnapshot?.effectiveAt)}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ENTITLEMENT_SUMMARY.map((item) => (
            <Metric
              key={item.key}
              label={item.label}
              value={formatEntitlementValue(item.key, overview.entitlements)}
            />
          ))}
        </div>
      </section>

      <section className={`${PANEL_CLASS} lg:col-span-12`}>
        <div className="mb-5 flex items-center gap-3">
          <FileText
            className="h-5 w-5 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            Invoices
          </h2>
        </div>

        {overview.invoices.length > 0 ? (
          <div className="grid gap-3">
            {overview.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="giq-subpanel grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">
                    {invoice.invoiceNumber
                      ? `Invoice ${invoice.invoiceNumber}`
                      : "Invoice snapshot"}
                  </p>
                  <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                    {formatSnapshotText(invoice.status)}
                    {invoice.paymentStatus
                      ? ` - ${formatSnapshotText(invoice.paymentStatus)}`
                      : ""}
                    {` - Issued ${formatDate(invoice.issuedAt)}`}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                    {formatCurrency(
                      invoice.totalAmountCents,
                      invoice.currency
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Due {formatDate(invoice.dueAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No local invoices"
            body="No invoice snapshots have been recorded for this account yet."
          />
        )}
      </section>
    </div>
  );
}

function SignedOutBilling() {
  return (
    <div className="giq-panel p-8">
      <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
      <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
        Sign in to view billing
      </h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        Sign in securely to review your plan, invoices, billing status, and
        current account limits.
      </p>
      <a
        href="/sign-in"
        className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
      >
        Sign in
      </a>
    </div>
  );
}

async function getLocalBillingOverview(user: BillingUser) {
  const entitlementsPromise = getEntitlementLimitsForCurrentUser(user);

  if (!user.dbUserId) {
    return {
      subscription: null,
      entitlementSnapshot: null,
      invoices: [],
      entitlements: await entitlementsPromise,
    };
  }

  const userId = user.dbUserId;
  const dbContext: DbContextUser = {
    dbUserId: user.dbUserId,
    profileId: user.profileId ?? user.dbUserId,
    profileRole: user.role ?? "member",
    tier: user.tier,
  };
  const billingCustomer = await safeQuery(
    () =>
      withDbRequestContext(dbContext, (tx) =>
        tx.billingCustomer.findUnique({
          where: { userId },
          select: { id: true },
        })
      ),
    null
  );

  const subscriptionWhere: Prisma.SubscriptionWhereInput = billingCustomer
    ? { OR: [{ userId }, { billingCustomerId: billingCustomer.id }] }
    : { userId };
  const invoiceWhere: Prisma.InvoiceRecordWhereInput = billingCustomer
    ? { OR: [{ userId }, { billingCustomerId: billingCustomer.id }] }
    : { userId };
  const entitlementWhere: Prisma.EntitlementSnapshotWhereInput =
    billingCustomer
      ? { OR: [{ userId }, { billingCustomerId: billingCustomer.id }] }
      : { userId };
  const now = new Date();

  const [subscription, entitlementSnapshot, invoices, entitlements] =
    await Promise.all([
      safeQuery(
        () =>
          withDbRequestContext(dbContext, (tx) => tx.subscription.findFirst({
            where: subscriptionWhere,
            orderBy: [
              { updatedAt: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],
            select: {
              id: true,
              planCode: true,
              status: true,
              startedAt: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              updatedAt: true,
            },
          })),
        null
      ),
      safeQuery(
        () =>
          withDbRequestContext(dbContext, (tx) => tx.entitlementSnapshot.findFirst({
            where: {
              AND: [
                entitlementWhere,
                {
                  status: "active",
                  effectiveAt: { lte: now },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
              ],
            },
            orderBy: [
              { effectiveAt: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],
            select: {
              id: true,
              status: true,
              effectiveAt: true,
              expiresAt: true,
              updatedAt: true,
            },
          })),
        null
      ),
      safeQuery(
        () =>
          withDbRequestContext(dbContext, (tx) => tx.invoiceRecord.findMany({
            where: invoiceWhere,
            orderBy: [
              { issuedAt: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],
            take: 5,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              paymentStatus: true,
              currency: true,
              totalAmountCents: true,
              issuedAt: true,
              dueAt: true,
            },
          })),
        []
      ),
      entitlementsPromise,
    ]);

  return {
    subscription,
    entitlementSnapshot,
    invoices,
    entitlements,
  };
}

function SubscriptionStatusBanner({
  currentPeriodEnd,
  status,
  updatedAt,
}: {
  currentPeriodEnd: Date | null;
  status: string;
  updatedAt: Date;
}) {
  const banner = getSubscriptionStatusBanner(status, currentPeriodEnd);

  return (
    <div
      className={`mb-5 rounded-md border px-4 py-3 ${STATUS_BANNER_TONE_CLASS[banner.tone]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {banner.label}
        </span>
        <span className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Read-only local snapshot
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {banner.body} Last updated {formatDate(updatedAt)}.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="giq-metric-card">
      <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold text-[hsl(var(--foreground))]">
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="text-[hsl(var(--subtle-foreground))]">{label}</span>
      <span className="text-right font-semibold text-[hsl(var(--foreground))]">
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  body,
  icon,
  title,
}: {
  body: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="giq-dashed-panel mt-5 p-5">
      <div className="giq-icon-plate mb-3 flex h-8 w-8 items-center justify-center rounded-md">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
    </div>
  );
}

function formatPlanCode(value: string | null | undefined) {
  if (!value) return "Tier defaults";
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (normalized in PLAN_LABELS) {
    return PLAN_LABELS[normalized as keyof typeof PLAN_LABELS];
  }
  return formatSnapshotText(value);
}

function formatSnapshotText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const clipped = cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function getSubscriptionStatusBanner(
  status: string,
  currentPeriodEnd: Date | null
) {
  const label = formatSnapshotText(status);
  const periodEndText = currentPeriodEnd
    ? ` Current period ends ${formatDate(currentPeriodEnd)}.`
    : "";

  switch (normalizeSnapshotKey(status)) {
    case "trialing":
      return {
        body: `Trial access is recorded in the local snapshot.${periodEndText}`,
        label,
        tone: "ok",
      } as const;
    case "active":
      return {
        body: `Subscription access is active in the local snapshot.${periodEndText}`,
        label,
        tone: "ok",
      } as const;
    case "past_due":
      return {
        body: `The local snapshot marks this subscription as past due.${periodEndText}`,
        label,
        tone: "warning",
      } as const;
    case "grace_period":
      return {
        body: `Local access is in a grace period.${periodEndText}`,
        label,
        tone: "warning",
      } as const;
    case "cancel_at_period_end":
      return {
        body: `The local snapshot shows this subscription ending after the current period.${periodEndText}`,
        label,
        tone: "warning",
      } as const;
    case "cancelled":
      return {
        body: "The local snapshot marks this subscription as cancelled.",
        label,
        tone: "danger",
      } as const;
    case "expired":
      return {
        body: "The local snapshot marks this subscription as expired.",
        label,
        tone: "danger",
      } as const;
    case "incomplete":
      return {
        body: `The local snapshot marks this subscription setup as incomplete.${periodEndText}`,
        label,
        tone: "warning",
      } as const;
    case "payment_failed":
      return {
        body: `The local snapshot records a failed payment state.${periodEndText}`,
        label,
        tone: "warning",
      } as const;
    case "manual_override":
      return {
        body: `Access is controlled by a local manual override.${periodEndText}`,
        label,
        tone: "neutral",
      } as const;
    case "enterprise_contract":
      return {
        body: `Billing is covered by a local enterprise contract.${periodEndText}`,
        label,
        tone: "ok",
      } as const;
    default:
      return {
        body: `Local subscription status is ${label}.${periodEndText}`,
        label,
        tone: "neutral",
      } as const;
  }
}

function normalizeSnapshotKey(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not recorded";
  return DATE_FORMATTER.format(value);
}

function formatCurrency(cents: number | null, currency: string | null) {
  if (cents === null) return "Pending";
  const amount = cents / 100;
  const code =
    currency && /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "AUD";

  try {
    return new Intl.NumberFormat("en-AU", {
      currency: code,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-AU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} ${code}`;
  }
}

function formatEntitlementValue(
  key: EntitlementKey,
  entitlements: EntitlementLimits
) {
  const value = entitlements[key];
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  if (value < 0) return "Unlimited";
  if (key.endsWith("_bytes")) return formatBytes(value);
  if (key.endsWith("_days")) return `${value.toLocaleString("en-AU")} days`;
  return value.toLocaleString("en-AU");
}

function formatBytes(value: number) {
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (value >= gib) return `${formatCompactNumber(value / gib)} GB`;
  if (value >= mib) return `${formatCompactNumber(value / mib)} MB`;
  return `${value.toLocaleString("en-AU")} bytes`;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-AU")
    : value.toLocaleString("en-AU", { maximumFractionDigits: 1 });
}
