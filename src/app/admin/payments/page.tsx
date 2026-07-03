import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin payments - GreyhoundIQ",
  description: "Read-only GreyhoundIQ payment reconciliation overview.",
};

type PaymentRecordRow = {
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  subscriptionId: string | null;
  invoiceRecordId: string | null;
  status: string;
  currency: string;
  amountCents: number;
  occurredAt: Date;
  createdAt: Date;
};

type RefundRecordRow = PaymentRecordRow & {
  paymentRecordId: string | null;
};

type CreditNoteRecordRow = PaymentRecordRow;

export default async function AdminPaymentsPage() {
  await requireModeratorProfile();
  const [payments, refunds, creditNotes] = await Promise.all([
    getPaymentRecords(),
    getRefundRecords(),
    getCreditNoteRecords(),
  ]);

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
          Payment reconciliation
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Latest 20 local payment, refund, and credit note records for
          operational reconciliation.
        </p>

        <PaymentRecordsTable records={payments} />
        <RefundRecordsTable records={refunds} />
        <CreditNoteRecordsTable records={creditNotes} />
      </section>
    </main>
  );
}

function PaymentRecordsTable({ records }: { records: PaymentRecordRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
        Payments
      </h2>
      <div className="giq-table-shell mt-4 overflow-x-auto">
        <table className="w-full min-w-[1500px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Payment ID</th>
              <th className="px-4 py-3 text-left">User ID</th>
              <th className="px-4 py-3 text-left">Billing customer ID</th>
              <th className="px-4 py-3 text-left">Subscription ID</th>
              <th className="px-4 py-3 text-left">Invoice record ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Currency</th>
              <th className="px-4 py-3 text-right">Amount cents</th>
              <th className="px-4 py-3 text-left">Occurred</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <EmptyRow colSpan={10}>No payment records found.</EmptyRow>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="border-t border-white/[0.06]">
                  <MonoCell>{record.id}</MonoCell>
                  <MonoCell>{record.userId ?? "No user"}</MonoCell>
                  <MonoCell>{record.billingCustomerId ?? "No customer"}</MonoCell>
                  <MonoCell>
                    {record.subscriptionId ?? "No subscription"}
                  </MonoCell>
                  <MonoCell>{record.invoiceRecordId ?? "No invoice"}</MonoCell>
                  <TextCell>{record.status}</TextCell>
                  <TextCell>{record.currency}</TextCell>
                  <AmountCell amountCents={record.amountCents} />
                  <DateCell date={record.occurredAt} />
                  <DateCell date={record.createdAt} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RefundRecordsTable({ records }: { records: RefundRecordRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
        Refunds
      </h2>
      <div className="giq-table-shell mt-4 overflow-x-auto">
        <table className="w-full min-w-[1640px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Refund ID</th>
              <th className="px-4 py-3 text-left">User ID</th>
              <th className="px-4 py-3 text-left">Billing customer ID</th>
              <th className="px-4 py-3 text-left">Subscription ID</th>
              <th className="px-4 py-3 text-left">Invoice record ID</th>
              <th className="px-4 py-3 text-left">Payment record ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Currency</th>
              <th className="px-4 py-3 text-right">Amount cents</th>
              <th className="px-4 py-3 text-left">Occurred</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <EmptyRow colSpan={11}>No refund records found.</EmptyRow>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="border-t border-white/[0.06]">
                  <MonoCell>{record.id}</MonoCell>
                  <MonoCell>{record.userId ?? "No user"}</MonoCell>
                  <MonoCell>{record.billingCustomerId ?? "No customer"}</MonoCell>
                  <MonoCell>
                    {record.subscriptionId ?? "No subscription"}
                  </MonoCell>
                  <MonoCell>{record.invoiceRecordId ?? "No invoice"}</MonoCell>
                  <MonoCell>{record.paymentRecordId ?? "No payment"}</MonoCell>
                  <TextCell>{record.status}</TextCell>
                  <TextCell>{record.currency}</TextCell>
                  <AmountCell amountCents={record.amountCents} />
                  <DateCell date={record.occurredAt} />
                  <DateCell date={record.createdAt} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreditNoteRecordsTable({
  records,
}: {
  records: CreditNoteRecordRow[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
        Credit notes
      </h2>
      <div className="giq-table-shell mt-4 overflow-x-auto">
        <table className="w-full min-w-[1500px]">
          <thead>
            <tr className="giq-table-head">
              <th className="px-4 py-3 text-left">Credit note ID</th>
              <th className="px-4 py-3 text-left">User ID</th>
              <th className="px-4 py-3 text-left">Billing customer ID</th>
              <th className="px-4 py-3 text-left">Subscription ID</th>
              <th className="px-4 py-3 text-left">Invoice record ID</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Currency</th>
              <th className="px-4 py-3 text-right">Amount cents</th>
              <th className="px-4 py-3 text-left">Occurred</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <EmptyRow colSpan={10}>No credit note records found.</EmptyRow>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="border-t border-white/[0.06]">
                  <MonoCell>{record.id}</MonoCell>
                  <MonoCell>{record.userId ?? "No user"}</MonoCell>
                  <MonoCell>{record.billingCustomerId ?? "No customer"}</MonoCell>
                  <MonoCell>
                    {record.subscriptionId ?? "No subscription"}
                  </MonoCell>
                  <MonoCell>{record.invoiceRecordId ?? "No invoice"}</MonoCell>
                  <TextCell>{record.status}</TextCell>
                  <TextCell>{record.currency}</TextCell>
                  <AmountCell amountCents={record.amountCents} />
                  <DateCell date={record.occurredAt} />
                  <DateCell date={record.createdAt} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getPaymentRecords() {
  return safeQuery<PaymentRecordRow[]>(
    () =>
      prisma.paymentRecord.findMany({
        orderBy: [
          { occurredAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 20,
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
          subscriptionId: true,
          invoiceRecordId: true,
          status: true,
          currency: true,
          amountCents: true,
          occurredAt: true,
          createdAt: true,
        },
      }),
    []
  );
}

function getRefundRecords() {
  return safeQuery<RefundRecordRow[]>(
    () =>
      prisma.refundRecord.findMany({
        orderBy: [
          { occurredAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 20,
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
          subscriptionId: true,
          invoiceRecordId: true,
          paymentRecordId: true,
          status: true,
          currency: true,
          amountCents: true,
          occurredAt: true,
          createdAt: true,
        },
      }),
    []
  );
}

function getCreditNoteRecords() {
  return safeQuery<CreditNoteRecordRow[]>(
    () =>
      prisma.creditNoteRecord.findMany({
        orderBy: [
          { occurredAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: 20,
        select: {
          id: true,
          userId: true,
          billingCustomerId: true,
          subscriptionId: true,
          invoiceRecordId: true,
          status: true,
          currency: true,
          amountCents: true,
          occurredAt: true,
          createdAt: true,
        },
      }),
    []
  );
}

function EmptyRow({
  children,
  colSpan,
}: {
  children: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
      >
        {children}
      </td>
    </tr>
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

function AmountCell({ amountCents }: { amountCents: number }) {
  return (
    <td className="px-4 py-3 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
      {amountCents.toLocaleString("en-AU")}
    </td>
  );
}

function DateCell({ date }: { date: Date }) {
  return (
    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
      {formatDateTime(date)}
    </td>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
