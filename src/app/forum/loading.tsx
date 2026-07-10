import { Skeleton, SkeletonGroup, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading groups">
      <div className="hidden border-b border-white/[0.07] bg-[hsl(var(--card)/0.72)] [.giq-member-shell_&]:block">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
          <div className="max-w-2xl flex-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-10 w-40" />
            <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 w-full rounded-xl sm:w-36" />
            <Skeleton className="h-11 w-full rounded-xl sm:w-40" />
          </div>
        </div>
      </div>

      <section className="giq-page-hero relative hidden min-h-[420px] items-center overflow-hidden [.giq-public-shell_&]:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,hsl(var(--primary-bright)/0.10),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(270_24%_3%))]"
        />
        <div className="giq-page-hero-inner giq-hero-split relative mx-auto w-full max-w-7xl px-6 py-14 md:py-20">
          <div className="max-w-2xl">
            <Skeleton className="h-11 w-[28rem] max-w-full" />
            <Skeleton className="mt-3 h-11 w-[22rem] max-w-[82%]" />
            <Skeleton className="mt-6 h-4 w-[34rem] max-w-full" />
            <Skeleton className="mt-2 h-4 w-[28rem] max-w-[88%]" />
          </div>
          <SkeletonPanel className="aspect-[16/9] min-h-[220px] p-0 sm:min-h-[260px]" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:gap-8 lg:px-8 [.giq-public-shell_&]:py-10 sm:[.giq-public-shell_&]:py-12">
        <div className="min-w-0">
          <div className="mb-5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonPanel key={i} className="overflow-hidden p-0">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-48 max-w-full" />
                    <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
                </div>
                <div className="space-y-1 px-4 py-2">
                  {Array.from({ length: 3 }, (_, j) => (
                    <div
                      key={j}
                      className="flex min-h-16 items-center gap-3 py-3"
                    >
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="mt-2 h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-4 w-10 shrink-0" />
                    </div>
                  ))}
                </div>
              </SkeletonPanel>
            ))}
          </div>
        </div>

        <aside className="min-w-0 self-start">
          <div className="mb-5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <SkeletonPanel className="space-y-1 overflow-hidden p-0">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="flex min-h-20 items-start gap-3 border-b border-white/[0.05] p-4 last:border-0"
              >
                <Skeleton className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </SkeletonPanel>
        </aside>
      </section>
    </SkeletonGroup>
  );
}
