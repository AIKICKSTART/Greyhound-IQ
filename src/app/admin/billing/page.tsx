import { AdminStatusForm } from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin billing - GreyhoundIQ",
  description: "Read-only GreyhoundIQ billing customer overview.",
};

type BillingCustomerRow = {
  id: string;
  userId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function AdminBillingPage() {
  await requireAdminProfile();
  const customers = await getBillingCustomers();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Billing customers"
        description="Latest 10 local billing customer records. Raw provider payloads and metadata are not displayed here."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Customer ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No billing customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-t border-white/[0.06]"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--foreground))]">
                      {customer.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[hsl(var(--muted-foreground))]">
                      {customer.userId ?? "No user"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                      {customer.status}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(customer.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(customer.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="billingCustomer"
                        id={customer.id}
                        currentStatus={customer.status}
                        statuses={["active", "inactive", "suspended", "archived"]}
                        path="/admin/billing"
                      />
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

function getBillingCustomers() {
  return safeQuery<BillingCustomerRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.billingCustomer.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      ),
    []
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
