import type { ReactNode } from "react";
import { PageTitle } from "@/components/page-title";

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
        <PageTitle size="compact" className="min-w-0">
          {title}
        </PageTitle>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
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
