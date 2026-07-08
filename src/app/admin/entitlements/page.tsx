import { AdminStatusForm } from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin entitlements - GreyhoundIQ",
  description: "Read-only GreyhoundIQ entitlement snapshot overview.",
};

type EntitlementSnapshotRecord = {
  id: string;
  userId: string | null;
  billingCustomerId: string | null;
  subscriptionId: string | null;
  status: string;
  entitlementsJson: string;
  effectiveAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
};

type EntitlementSnapshotRow = Omit<
  EntitlementSnapshotRecord,
  "entitlementsJson"
> & {
  entitlementsByteLength: number;
  entitlementsTopLevelKeyCount: number | null;
};

const textEncoder = new TextEncoder();

export default async function AdminEntitlementsPage() {
  await requireModeratorProfile();
  const snapshots = await getEntitlementSnapshots();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AdminPageHeader
        title="Entitlement snapshots"
        description="Latest 20 local entitlement snapshot rows. Raw entitlement JSON values are not displayed; only JSON byte length and top-level key count are shown."
      />

      <section className="giq-panel p-6">
        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1500px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Snapshot ID</th>
                <th className="px-4 py-3 text-left">User ID</th>
                <th className="px-4 py-3 text-left">Billing customer ID</th>
                <th className="px-4 py-3 text-left">Subscription ID</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Entitlement JSON bytes</th>
                <th className="px-4 py-3 text-right">Top-level keys</th>
                <th className="px-4 py-3 text-left">Effective</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No entitlement snapshots found.
                  </td>
                </tr>
              ) : (
                snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-t border-white/[0.06]">
                    <MonoCell>{snapshot.id}</MonoCell>
                    <MonoCell>{snapshot.userId ?? "No user"}</MonoCell>
                    <MonoCell>
                      {snapshot.billingCustomerId ?? "No customer"}
                    </MonoCell>
                    <MonoCell>
                      {snapshot.subscriptionId ?? "No subscription"}
                    </MonoCell>
                    <TextCell>{snapshot.status}</TextCell>
                    <NumberCell>{snapshot.entitlementsByteLength}</NumberCell>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
                      {formatNullableNumber(
                        snapshot.entitlementsTopLevelKeyCount,
                        "Invalid JSON"
                      )}
                    </td>
                    <DateCell
                      date={snapshot.effectiveAt}
                      emptyLabel="Not effective"
                    />
                    <DateCell date={snapshot.expiresAt} emptyLabel="No expiry" />
                    <DateCell
                      date={snapshot.createdAt}
                      emptyLabel="Not recorded"
                    />
                    <td className="px-4 py-3">
                      <AdminStatusForm
                        resource="entitlementSnapshot"
                        id={snapshot.id}
                        currentStatus={snapshot.status}
                        statuses={["active", "expired", "replaced", "ignored", "inactive"]}
                        path="/admin/entitlements"
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

async function getEntitlementSnapshots(): Promise<EntitlementSnapshotRow[]> {
  const snapshots = await safeQuery<EntitlementSnapshotRecord[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.entitlementSnapshot.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
          select: {
            id: true,
            userId: true,
            billingCustomerId: true,
            subscriptionId: true,
            status: true,
            entitlementsJson: true,
            effectiveAt: true,
            expiresAt: true,
            createdAt: true,
          },
        })
      ),
    []
  );

  return snapshots.map(toEntitlementSnapshotRow);
}

function toEntitlementSnapshotRow(
  snapshot: EntitlementSnapshotRecord
): EntitlementSnapshotRow {
  const { entitlementsJson, ...safeFields } = snapshot;

  return {
    ...safeFields,
    entitlementsByteLength: textEncoder.encode(entitlementsJson).byteLength,
    entitlementsTopLevelKeyCount: countTopLevelKeys(entitlementsJson),
  };
}

function countTopLevelKeys(json: string) {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") {
      return 0;
    }
    return Object.keys(parsed).length;
  } catch {
    return null;
  }
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

function NumberCell({ children }: { children: number }) {
  return (
    <td className="px-4 py-3 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">
      {children.toLocaleString("en-AU")}
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

function formatNullableNumber(value: number | null, emptyLabel: string) {
  return value === null ? emptyLabel : value.toLocaleString("en-AU");
}

function formatDateTime(date: Date | null, emptyLabel: string) {
  if (!date) return emptyLabel;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
