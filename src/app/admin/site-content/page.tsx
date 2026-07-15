import { AlertTriangle } from "lucide-react";
import { requireAdminProfile } from "@/lib/auth";
import { getPricingContent, dollarsFromPriceLabel } from "@/lib/site-content";
import { getStripeCheckoutEnv } from "@/lib/billing/stripe-env";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { updatePricingContentAction } from "@/app/admin/mutations";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Site content - GreyhoundIQ admin",
  description: "Edit the public pricing page.",
};

const INPUT = "giq-form-control w-full px-3 py-2 text-[13px]";
const LABEL = "block text-[12px] font-semibold text-[hsl(var(--muted-foreground))] mb-1";

// Read-only: the real amount Stripe charges (from the configured price IDs). The
// displayed /pricing number is independent, so warn admins if they diverge.
async function getStripeAmounts(): Promise<
  { monthly: number | null; yearly: number | null; error: string | null }
> {
  try {
    const env = getStripeCheckoutEnv();
    const stripe = getStripeClient(env.secretKey);
    const [m, y] = await Promise.all([
      stripe.prices.retrieve(env.prices.pro.monthly),
      stripe.prices.retrieve(env.prices.pro.yearly),
    ]);
    return {
      monthly: m.unit_amount != null ? m.unit_amount / 100 : null,
      yearly: y.unit_amount != null ? y.unit_amount / 100 : null,
      error: null,
    };
  } catch (err) {
    return { monthly: null, yearly: null, error: err instanceof Error ? err.message : "unknown" };
  }
}

export default async function SiteContentAdmin() {
  await requireAdminProfile();
  const { plans, yearlyNote } = await getPricingContent();
  const stripe = await getStripeAmounts();

  const pro = plans.find((p) => p.id === "pro");
  const displayedMonthly = pro ? dollarsFromPriceLabel(pro.price) : null;
  const mismatch =
    stripe.monthly != null && displayedMonthly != null && stripe.monthly !== displayedMonthly;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Site content — Pricing"
        description="Edit the public /pricing page. Saves instantly and revalidates the live page. The displayed price is marketing copy; the amount Stripe actually charges comes from the configured price IDs (see the notice)."
      />

      {/* Stripe charge vs displayed price */}
      <section className="giq-panel mb-6 p-5">
        <h2 className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
          Actual Stripe charge (Pro)
        </h2>
        {stripe.error ? (
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            Could not read Stripe prices: {stripe.error}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[hsl(var(--foreground))] tabular-nums">
            Monthly {stripe.monthly != null ? `$${stripe.monthly}` : "—"} · Yearly{" "}
            {stripe.yearly != null ? `$${stripe.yearly}` : "—"} AUD
          </p>
        )}
        {mismatch && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Displayed Pro price (${displayedMonthly}/mo) does not match what Stripe charges
              (${stripe.monthly}/mo). Customers will see one number and be billed another. To
              change the charged amount you must rotate the <code>STRIPE_PRICE_PRO_*</code>{" "}
              Secret Manager values and redeploy — editing here only changes the display.
            </span>
          </div>
        )}
      </section>

      <form action={updatePricingContentAction} className="space-y-6">
        {plans.map((plan) => (
          <fieldset key={plan.id} className="giq-panel space-y-3 p-5">
            <legend className="px-1 text-[13px] font-semibold text-[hsl(var(--foreground))] capitalize">
              {plan.id.replace("_", " ")} plan
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${plan.id}-name`} className={LABEL}>Name</label>
                <input id={`${plan.id}-name`} name={`${plan.id}_name`} defaultValue={plan.name} className={INPUT} />
              </div>
              <div>
                <label htmlFor={`${plan.id}-cta`} className={LABEL}>CTA button</label>
                <input id={`${plan.id}-cta`} name={`${plan.id}_cta`} defaultValue={plan.cta} className={INPUT} />
              </div>
              <div>
                <label htmlFor={`${plan.id}-price`} className={LABEL}>Price (display, e.g. $20)</label>
                <input id={`${plan.id}-price`} name={`${plan.id}_price`} defaultValue={plan.price} className={INPUT} />
              </div>
              <div>
                <label htmlFor={`${plan.id}-period`} className={LABEL}>Period (e.g. /month or $204/year)</label>
                <input id={`${plan.id}-period`} name={`${plan.id}_period`} defaultValue={plan.period} className={INPUT} />
              </div>
            </div>
            <div>
              <label htmlFor={`${plan.id}-description`} className={LABEL}>Description</label>
              <input id={`${plan.id}-description`} name={`${plan.id}_description`} defaultValue={plan.description} className={INPUT} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${plan.id}-features`} className={LABEL}>Included features (one per line)</label>
                <textarea
                  id={`${plan.id}-features`}
                  name={`${plan.id}_features`}
                  defaultValue={plan.features.join("\n")}
                  rows={8}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor={`${plan.id}-not-included`} className={LABEL}>Not included (one per line)</label>
                <textarea
                  id={`${plan.id}-not-included`}
                  name={`${plan.id}_notIncluded`}
                  defaultValue={plan.notIncluded.join("\n")}
                  rows={8}
                  className={INPUT}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
              <input type="checkbox" name={`${plan.id}_highlighted`} defaultChecked={plan.highlighted} />
              Highlight as “most popular”
            </label>
          </fieldset>
        ))}

        <div>
          <label htmlFor="yearly-note" className={LABEL}>Yearly note (below the plans)</label>
          <input id="yearly-note" name="yearlyNote" defaultValue={yearlyNote} className={INPUT} />
        </div>

        <SubmitButton className="giq-button giq-button-primary px-5 text-[13px] font-semibold">
          Save pricing
        </SubmitButton>
      </form>
    </main>
  );
}
