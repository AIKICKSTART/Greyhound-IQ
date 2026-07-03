import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin invoices - GreyhoundIQ",
  description: "Read-only GreyhoundIQ invoice record overview.",
};

type InvoiceRecordRow = {
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  subscriptionId: string | null;
  invoiceNumber: string | null;
  status: string;
  paymentStatus: string | null;
  currency: string | null;
  totalAmountCents: number | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
};

export default async function AdminInvoicesPage() {
  await requireModeratorProfile();
  const invoices = await getInvoiceRecords();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link href="/admin" className="giq-outline-action mb-6 w-fit">
        Back to admin
      </Link>

      <section className="giq-panel p-6">
        <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[hsl(var(--foreground))]">
          Invoices
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local invoice records. Provider identifiers and raw payloads
          are not displayed here.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1680px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Invoice ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Billing customer ID</th>
                <th className="px-4 py-3 text-left">Subscription ID</th>
                <th className="px-4 py-3 text-left">Invoice number</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Payment status</th>
                <th className="px-4 py-3 text-left">Currency</th>
                <th className="px-4 py-3 text-right">Total amount cents</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">Due</th>
                <th className="px-4 py-3 text-left">Paid</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No invoice records found.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-white/[0.06]">
                    <MonoCell>{invoice.id}</MonoCell>
                    <MonoCell>{invoice.userId ?? "No user"}</MonoCell>
                    <MonoCell>
                      {invoice.billingCustomerId ?? "No customer"}
                    </MonoCell>
                    <MonoCell>{invoice.subscriptionId ?? "No subscription"}</MonoCell>
                    <MonoCell>{invoice.invoiceNumber ?? "No number"}</MonoCell>
                    <TextCell>{invoice.status}</TextCell>
                    <TextCell>
                      {invoice.paymentStatus ?? "No payment status"}
                    </TextCell>
                    <TextCell>{invoice.currency ?? "No currency"}</TextCell>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatNullableNumber(invoice.totalAmountCents)}
                    </td>
                    <DateCell date={invoice.issuedAt} emptyLabel="Not issued" />
                    <DateCell date={invoice.dueAt} emptyLabel="No due date" />
                    <DateCell date={invoice.paidAt} emptyLabel="Not paid" />
                    <DateCell date={invoice.createdAt} emptyLabel="Not recorded" />
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

function getInvoiceRecords() {
  return safeQuery<InvoiceRecordRow[]>(
    () =>
      prisma.invoiceRecord.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
          subscriptionId: true,
          invoiceNumber: true,
          status: true,
          paymentStatus: true,
          currency: true,
          totalAmountCents: true,
          issuedAt: true,
          dueAt: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    []
  );
}

function MonoCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function TextCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function DateCell({
  date,
  emptyLabel,
}: {
  date: Date | null;
  emptyLabel: string;
}) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date, emptyLabel)}
    </td>
  );
}

function formatNullableNumber(value: number | null) {
  return value === null ? "Pending" : value.toLocaleString("en-AU");
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
