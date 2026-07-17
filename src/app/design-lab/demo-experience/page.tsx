import type { Metadata } from "next";
import Link from "next/link";

import { DemoExperienceScreenMap } from "@/components/demo-experience-screen-map";
import { AdminControlCentreFrameLab } from "@/components/admin-control-centre-frame-lab";
import { resolveDesignLabArea } from "@/components/design-lab-workspace";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

export const metadata: Metadata = {
  title: "Complete Demo Experience - GreyhoundIQ Design Lab",
  description:
    "Clickable GreyhoundIQ screen, user-story and acceptance-criteria registry.",
  robots: { index: false, follow: false },
};

type DemoExperienceSearchParams = {
  view?: string | string[];
  area?: string | string[];
  route?: string | string[];
};

export default async function DemoExperiencePage({
  searchParams,
}: {
  searchParams: Promise<DemoExperienceSearchParams>;
}) {
  await requireDesignLabReviewer();

  const query = await searchParams;
  const view = firstValue(query.view);
  if (view === "admin-frames") return <AdminControlCentreFrames />;

  return (
    <DemoExperienceScreenMap
      initialArea={resolveDesignLabArea(query.area, "screens")}
      initialContractRoute={firstValue(query.route)}
      basePath="/design-lab/demo-experience"
    />
  );
}

function AdminControlCentreFrames() {
  return (
    <div
      className="min-h-screen bg-[hsl(var(--background))] px-4 py-6 text-[hsl(var(--foreground))] sm:px-6 lg:px-10"
      data-admin-frame-lab
    >
      <style>{`
        body:has([data-admin-frame-lab]) .giq-site-header,
        body:has([data-admin-frame-lab]) .giq-member-header,
        body:has([data-admin-frame-lab]) .giq-mobile-dock,
        body:has([data-admin-frame-lab]) .giq-hub-conversation-dock,
        body:has([data-admin-frame-lab]) .giq-footer-shell,
        body:has([data-admin-frame-lab]) .giq-alert-wrap {
          display: none !important;
        }
      `}</style>

      <div className="mx-auto max-w-[1180px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Control Centre interactive device shells
            </h1>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Choose a production viewport for the real protected Control
              Centre. One live shell loads at a time, avoiding duplicate backend
              work while preserving normal clicks, forms, menus, and keyboard
              input.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Control Centre frame actions"
          >
            <Link
              className="giq-outline-action"
              href="/design-lab/demo-experience"
            >
              Screen registry
            </Link>
            <Link
              className="giq-outline-action"
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open full Control Centre
            </Link>
            <a
              className="giq-button min-h-11 px-4 text-sm font-semibold"
              href="/design-lab/demo-experience?view=admin-frames"
            >
              Reload shells
            </a>
          </nav>
        </header>

        <AdminControlCentreFrameLab />
      </div>
    </div>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
