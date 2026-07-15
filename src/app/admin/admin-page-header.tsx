import type { ReactNode } from "react";

// Shared header for every admin page. The sidebar owns section context and
// navigation, so this header stays focused on the current task.
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      data-onboarding-target="admin-page-header"
      className="mb-7 flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-8 w-1 shrink-0 rounded-full bg-[hsl(var(--primary-bright))] shadow-[0_0_16px_hsl(var(--primary-bright)/0.72)]"
          />
          <h1 className="min-w-0 text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.025em] text-[hsl(var(--foreground))]">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))] sm:pl-4">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          data-onboarding-target="admin-page-actions"
          className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
