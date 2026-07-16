import { Activity, LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";

import { AdminOperationStatus } from "@/app/admin/admin-operation-status";
import { requireModeratorProfile } from "@/lib/auth";
import { AdminNav } from "@/app/admin/admin-nav";
import { isFullAccessDemo } from "@/lib/demo-access";
import { demoProfilePortraitForName } from "@/lib/demo-profile-media";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const current = await getAdminOperator();

  return (
    <div
      data-admin-shell
      data-admin-role={current.profileRole}
      data-onboarding-target="admin-shell"
      className="flex min-h-screen w-full flex-col bg-[radial-gradient(circle_at_82%_-10%,hsl(var(--primary)/0.13),transparent_34%),hsl(var(--background))] lg:flex-row"
    >
      <AdminNav
        operatorName={current.displayName}
        operatorAvatarUrl={
          isFullAccessDemo()
            ? demoProfilePortraitForName(current.displayName)
            : null
        }
        operatorRole={current.profileRole}
      />
      <div className="min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <AdminOperatorBar
          environment={adminEnvironmentLabel()}
          operatorName={current.displayName}
          operatorRole={current.profileRole}
        />
        <Suspense fallback={null}>
          <AdminOperationStatus />
        </Suspense>
        <div data-onboarding-target="admin-page-content">{children}</div>
      </div>
    </div>
  );
}

async function getAdminOperator() {
  try {
    return await requireModeratorProfile();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "auth.unauthorized") {
        redirect("/sign-in");
      }
      if (err.message === "auth.forbidden" || err.message === "auth.profile_missing") {
        forbidden();
      }
    }
    throw err;
  }
}

function AdminOperatorBar({
  environment,
  operatorName,
  operatorRole,
}: {
  environment: string;
  operatorName: string;
  operatorRole: string;
}) {
  return (
    <header
      data-onboarding-target="admin-operator-status"
      className="relative z-30 border-b border-white/[0.08] bg-[linear-gradient(90deg,hsl(var(--surface-2)/0.94),hsl(var(--surface-1)/0.82))] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:px-6 lg:sticky lg:top-0 lg:px-10"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="giq-icon-plate grid size-10 shrink-0 place-items-center rounded-xl">
          <ShieldCheck className="size-5 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[hsl(var(--primary-light))]">
            GreyhoundIQ operator console
          </p>
          <p className="truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
            {operatorName}
            <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
              {operatorRole}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
          {operatorRole === "moderator" ? (
            <span className="inline-flex min-h-8 items-center rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 text-amber-200">
              Moderation mode · Admin mutations hidden
            </span>
          ) : null}
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 text-[hsl(var(--muted-foreground))]">
            <Server className="size-3.5" aria-hidden="true" />
            {environment}
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 text-emerald-200">
            <Activity className="size-3.5" aria-hidden="true" />
            Live session
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[hsl(var(--secondary)/0.22)] bg-[hsl(var(--secondary)/0.07)] px-3 text-[hsl(var(--secondary-light))]">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Audited
          </span>
        </div>
      </div>
    </header>
  );
}

function adminEnvironmentLabel() {
  if (isFullAccessDemo()) return "Read-only demo";
  if (process.env.VERCEL_ENV === "preview") return "Preview";
  if (process.env.VERCEL_ENV === "production") return "Production";
  if (process.env.NODE_ENV === "development") return "Local demo";
  return "Staging";
}
