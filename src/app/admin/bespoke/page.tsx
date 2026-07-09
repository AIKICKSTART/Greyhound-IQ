import { requireModeratorProfile } from "@/lib/auth";
import { listCustomDesignRequests, BESPOKE_STATUSES } from "@/lib/bespoke-service";
import { updateBespokeRequestAction } from "@/app/admin/mutations";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bespoke design - GreyhoundsIQ admin",
  description: "Concierge $500 page-design request queue.",
};

const INPUT = "giq-form-control w-full px-3 py-2 text-[13px]";

export default async function BespokeAdmin() {
  const current = await requireModeratorProfile();
  const requests = await listCustomDesignRequests(current);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Bespoke design requests"
        description="Paid $500 concierge packages: 1 business + 1 trainer + 1 punter + up to 5 dog pages, team-built. Mark pages CustomPage.bespoke = true when delivered (exempts them from self-serve limits)."
      />
      <section className="giq-panel divide-y divide-white/[0.06]">
        {requests.length === 0 && (
          <p className="p-6 text-[13px] text-[hsl(var(--muted-foreground))]">
            No requests yet.
          </p>
        )}
        {requests.map((r) => (
          <form key={r.id} action={updateBespokeRequestAction} className="space-y-3 p-6">
            <input type="hidden" name="id" value={r.id} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                  {(r.amount / 100).toLocaleString("en-AU", {
                    style: "currency",
                    currency: (r.currency || "aud").toUpperCase(),
                  })}{" "}
                  · {r.status}
                </div>
                <div className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                  Buyer profile {r.buyerProfileId} · {r.createdAt.toISOString().slice(0, 10)}
                </div>
              </div>
              <select name="status" defaultValue={r.status} className="max-w-[180px]">
                {BESPOKE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="notes"
              defaultValue={r.notes ?? ""}
              placeholder="Fulfilment notes…"
              rows={2}
              maxLength={2000}
              className={INPUT}
            />
            <SubmitButton className="giq-button giq-button-glass min-h-9 px-4 text-[12px]">
              Update
            </SubmitButton>
          </form>
        ))}
      </section>
    </main>
  );
}
