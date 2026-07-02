import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin - GreyhoundIQ",
  description: "Read-only GreyhoundIQ administration overview.",
};

const COUNTS = [
  { key: "users", label: "Users" },
  { key: "billingCustomers", label: "Billing customers" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "webhookEvents", label: "Webhook events" },
  { key: "invoiceRecords", label: "Invoice records" },
  { key: "paymentRecords", label: "Payment records" },
  { key: "usageOutbox", label: "Usage outbox" },
] as const;

type CountKey = (typeof COUNTS)[number]["key"];
type AdminCounts = Record<CountKey, number | null>;

export default async function AdminPage() {
  await requireModeratorProfile();
  const counts = await getAdminCounts();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/account" className="giq-outline-action mb-6 w-fit">
        Back to account
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Read-only overview
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Local account, billing, webhook, invoice, and usage outbox counts.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/users" className="giq-outline-action">
            Users
          </Link>
          <Link href="/admin/organizations" className="giq-outline-action">
            Organizations
          </Link>
          <Link href="/admin/subscriptions" className="giq-outline-action">
            Subscriptions
          </Link>
          <Link href="/admin/entitlements" className="giq-outline-action">
            Entitlements
          </Link>
          <Link href="/admin/invoices" className="giq-outline-action">
            Invoices
          </Link>
          <Link href="/admin/payments" className="giq-outline-action">
            Payments
          </Link>
          <Link href="/admin/webhooks" className="giq-outline-action">
            Webhook events
          </Link>
          <Link href="/admin/support" className="giq-outline-action">
            Support tickets
          </Link>
          <Link href="/admin/billing" className="giq-outline-action">
            Billing
          </Link>
          <Link href="/admin/billing-events" className="giq-outline-action">
            Billing events
          </Link>
          <Link href="/admin/usage" className="giq-outline-action">
            Usage
          </Link>
          <Link href="/admin/audit" className="giq-outline-action">
            Audit
          </Link>
          <Link href="/admin/reports" className="giq-outline-action">
            Reports
          </Link>
          <Link href="/admin/source-health" className="giq-outline-action">
            Source health
          </Link>
          <Link href="/admin/account-deletion" className="giq-outline-action">
            Account deletion
          </Link>
          <Link href="/admin/jobs" className="giq-outline-action">
            Jobs
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTS.map((item) => (
            <div key={item.key} className="giq-metric-card">
              <p className="text-[11px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
                {formatCount(counts[item.key])}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

async function getAdminCounts(): Promise<AdminCounts> {
  const [
    users,
    billingCustomers,
    subscriptions,
    webhookEvents,
    invoiceRecords,
    paymentRecords,
    usageOutbox,
  ] = await Promise.all([
    countRows(() => prisma.user.count()),
    countRows(() => prisma.billingCustomer.count()),
    countRows(() => prisma.subscription.count()),
    countRows(() => prisma.webhookEvent.count()),
    countRows(() => prisma.invoiceRecord.count()),
    countRows(() => prisma.paymentRecord.count()),
    countRows(() => prisma.usageOutbox.count()),
  ]);

  return {
    users,
    billingCustomers,
    subscriptions,
    webhookEvents,
    invoiceRecords,
    paymentRecords,
    usageOutbox,
  };
}

function countRows(fn: () => Promise<number>) {
  return safeQuery<number | null>(fn, null);
}

function formatCount(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString("en-AU");
}
