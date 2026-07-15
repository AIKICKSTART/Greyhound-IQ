import {
  AdminEnabledForm,
  AdminPlanForms,
  AdminStatusForm,
} from "@/app/admin/form-controls";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { requireAdminProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin plans - GreyhoundIQ",
  description: "Read-only GreyhoundIQ plan catalog overview.",
};

type PriceCatalogRow = {
  id: string;
  interval: string;
  currency: string;
  amountCents: number;
  status: string;
};

type PlanEntitlementRow = {
  id: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  unit: string | null;
};

type PlanCatalogRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  prices: PriceCatalogRow[];
  entitlements: PlanEntitlementRow[];
};

export default async function AdminPlansPage() {
  await requireAdminProfile();
  const plans = await getPlans();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AdminPageHeader
        title="Plans"
        description="Create and update local plan catalog rows, prices, and entitlement limits. Provider IDs stay read-only and are not edited here."
      />

      <section className="giq-panel p-6">
        <div className="mt-6">
          <AdminPlanForms plans={plans.map((plan) => ({ id: plan.id, code: plan.code }))} path="/admin/plans" />
        </div>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1520px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Plan code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Prices</th>
                <th className="px-4 py-3 text-left">Entitlements</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
                  >
                    No plans found.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.code} className="border-t border-white/[0.06]">
                    <MonoCell>{plan.code}</MonoCell>
                    <TextCell>{plan.name}</TextCell>
                    <TextCell>{plan.status}</TextCell>
                    <PriceListCell prices={plan.prices} />
                    <EntitlementListCell entitlements={plan.entitlements} />
                    <td className="px-4 py-3 align-top">
                      <AdminStatusForm
                        resource="plan"
                        id={plan.id}
                        currentStatus={plan.status}
                        statuses={["active", "inactive", "archived"]}
                        path="/admin/plans"
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

function getPlans() {
  return safeQuery<PlanCatalogRow[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.plan.findMany({
          orderBy: { code: "asc" },
          take: 100,
          select: {
            code: true,
            id: true,
            name: true,
            status: true,
            prices: {
              orderBy: [{ interval: "asc" }, { currency: "asc" }],
              take: 100,
              select: {
                id: true,
                interval: true,
                currency: true,
                amountCents: true,
                status: true,
              },
            },
            entitlements: {
              orderBy: { featureKey: "asc" },
              take: 100,
              select: {
                id: true,
                featureKey: true,
                enabled: true,
                limitValue: true,
                unit: true,
              },
            },
          },
        })
      ),
    []
  );
}

function MonoCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 align-top font-mono text-[12px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function TextCell({ children }: { children: string }) {
  return (
    <td className="px-4 py-3 align-top text-[13px] text-[hsl(var(--foreground))]">
      {children}
    </td>
  );
}

function PriceListCell({ prices }: { prices: PriceCatalogRow[] }) {
  return (
    <td className="px-4 py-3 align-top">
      {prices.length === 0 ? (
        <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
          No prices
        </span>
      ) : (
        <ul className="space-y-2">
          {prices.map((price) => (
            <li key={price.id} className="space-y-2">
              <p className="font-mono text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {formatPrice(price)}
              </p>
              <AdminStatusForm
                resource="priceCatalog"
                id={price.id}
                currentStatus={price.status}
                statuses={["active", "inactive", "archived"]}
                path="/admin/plans"
              />
            </li>
          ))}
        </ul>
      )}
    </td>
  );
}

function EntitlementListCell({
  entitlements,
}: {
  entitlements: PlanEntitlementRow[];
}) {
  return (
    <td className="px-4 py-3 align-top">
      {entitlements.length === 0 ? (
        <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
          No entitlements
        </span>
      ) : (
        <ul className="space-y-2">
          {entitlements.map((entitlement) => (
            <li key={entitlement.id} className="space-y-2">
              <p className="font-mono text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {formatEntitlement(entitlement)}
              </p>
              <AdminEnabledForm
                resource="planEntitlement"
                id={entitlement.id}
                enabled={entitlement.enabled}
                path="/admin/plans"
              />
            </li>
          ))}
        </ul>
      )}
    </td>
  );
}

function formatPrice(price: PriceCatalogRow) {
  return `${price.interval} / ${price.currency} / ${price.amountCents.toLocaleString("en-AU")} cents / ${price.status}`;
}

function formatEntitlement(entitlement: PlanEntitlementRow) {
  const state = entitlement.enabled ? "enabled" : "disabled";
  const limit =
    entitlement.limitValue === null
      ? "no limit"
      : entitlement.limitValue.toLocaleString("en-AU");
  const unit = entitlement.unit ?? "no unit";

  return `${entitlement.featureKey} / ${state} / ${limit} / ${unit}`;
}
