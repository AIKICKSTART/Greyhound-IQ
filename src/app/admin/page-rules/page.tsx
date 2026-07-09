import { requireAdminProfile } from "@/lib/auth";
import { getAllPlatformFlags, PLATFORM_FLAGS } from "@/lib/platform-settings";
import { updatePageRulesAction } from "@/app/admin/mutations";
import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Page rules - GreyhoundsIQ admin",
  description: "Relax or tighten custom-page and marketplace fraud gates.",
};

const RULES: { name: string; key: string; label: string; blurb: string }[] = [
  {
    name: "requirePro",
    key: PLATFORM_FLAGS.requirePro,
    label: "Require Pro to create pages",
    blurb: "When on, only Pro+ users can create custom pages.",
  },
  {
    name: "requireApprovedOwnership",
    key: PLATFORM_FLAGS.requireApprovedOwnership,
    label: "Require approved ownership for dog pages",
    blurb: "When on, a dog page needs an admin-approved DogOwnership.",
  },
  {
    name: "requireRegisteredDog",
    key: PLATFORM_FLAGS.requireRegisteredDog,
    label: "Require registered dog",
    blurb: "When on, only dogs present in official data (sourceId) can get a page.",
  },
  {
    name: "enforceDogPageLimit",
    key: PLATFORM_FLAGS.enforceDogPageLimit,
    label: "Enforce dog-page limit (3 on Pro)",
    blurb: "When on, a 4th+ dog page requires Pro+.",
  },
];

export default async function PageRulesAdmin() {
  await requireAdminProfile();
  const flags = await getAllPlatformFlags();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
      <AdminPageHeader
        title="Page rules"
        description="Toggle the custom-page and marketplace fraud gates. Default is strict (all on). Relax only if moderation load requires it — every change is audited."
      />
      <section className="giq-panel p-6">
        <form action={updatePageRulesAction} className="space-y-4">
          {RULES.map((rule) => (
            <label
              key={rule.name}
              className="flex items-start gap-3 rounded-lg border border-white/[0.06] p-4"
            >
              <input
                type="checkbox"
                name={rule.name}
                defaultChecked={flags[rule.key as keyof typeof flags]}
                className="mt-1"
              />
              <span>
                <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))]">
                  {rule.label}
                </span>
                <span className="block text-[12px] text-[hsl(var(--muted-foreground))]">
                  {rule.blurb}
                </span>
              </span>
            </label>
          ))}
          <SubmitButton className="giq-button giq-button-primary px-5 text-[13px] font-semibold">
            Save rules
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
