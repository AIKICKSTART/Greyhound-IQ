import Link from "next/link";

import { requireModeratorProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin plans - GreyhoundIQ",
  description: "Read-only GreyhoundIQ plan catalog overview.",
};

type PriceCatalogRow = {
  interval: string;
  currency: string;
  amountCents: number;
  status: string;
};

type PlanEntitlementRow = {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  unit: string | null;
};

type PlanCatalogRow = {
  code: string;
  name: string;
  status: string;
  prices: PriceCatalogRow[];
  entitlements: PlanEntitlementRow[];
};

export default async function AdminPlansPage() {
  await requireModeratorProfile();
  const plans = await getPlans();

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
          Plans
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Local plan catalog with prices and entitlement limits. Only catalog,
          price, and entitlement display fields are shown.
        </p>

        <div className="giq-table-shell mt-6 overflow-x-auto">
          <table className="w-full min-w-[1320px]">
            <thead>
              <tr className="giq-table-head">
                <th className="px-4 py-3 text-left">Plan code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Prices</th>
                <th className="px-4 py-3 text-left">Entitlements</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                    <ListCell
                      emptyLabel="No prices"
                      items={plan.prices.map(formatPrice)}
                    />
                    <ListCell
                      emptyLabel="No entitlements"
                      items={plan.entitlements.map(formatEntitlement)}
                    />
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
      prisma.plan.findMany({
        orderBy: { code: "asc" },
        select: {
          code: true,
          name: true,
          status: true,
          prices: {
            orderBy: [{ interval: "asc" }, { currency: "asc" }],
            select: {
              interval: true,
              currency: true,
              amountCents: true,
              status: true,
            },
          },
          entitlements: {
            orderBy: { featureKey: "asc" },
            select: {
              featureKey: true,
              enabled: true,
              limitValue: true,
              unit: true,
            },
          },
        },
      }),
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

function ListCell({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: string[];
}) {
  return (
    <td className="px-4 py-3 align-top">
      {items.length === 0 ? (
        <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
          {emptyLabel}
        </span>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="font-mono text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]"
            >
              {item}
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
