import { Skeleton, SkeletonGroup, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading race details">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-[min(420px,80%)] md:h-12" />
          <Skeleton className="mt-3 h-4 w-[min(520px,70%)]" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
          <section className="min-w-0 space-y-5">
            <SkeletonPanel className="p-4 sm:p-6">
              <Skeleton className="aspect-video w-full rounded-xl" />
            </SkeletonPanel>
            <SkeletonPanel className="p-0">
              <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-6 w-44" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="flex min-w-0 items-center gap-3 border-b border-white/[0.04] p-3 last:border-0"
                >
                  <Skeleton className="h-9 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-full max-w-40" />
                    <div className="mt-2 flex items-center gap-3 sm:hidden">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  </div>
                  <div className="ml-auto hidden items-center gap-6 sm:flex">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </SkeletonPanel>
          </section>

          <aside className="min-w-0 space-y-3">
            <SkeletonPanel>
              <Skeleton className="h-3 w-24" />
              <div className="mt-5 grid gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-[60px]" />
                ))}
              </div>
            </SkeletonPanel>
          </aside>
        </div>
      </main>
    </SkeletonGroup>
  );
}
