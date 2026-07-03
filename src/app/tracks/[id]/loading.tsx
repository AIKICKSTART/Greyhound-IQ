import {
  Skeleton,
  SkeletonGroup,
  SkeletonPanel,
  SkeletonText,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading track guide">
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Skeleton className="mb-5 h-4 w-40" />
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <Skeleton className="h-12 w-[min(420px,80%)] md:h-14" />
              <Skeleton className="mt-4 h-4 w-[min(520px,100%)]" />
              <Skeleton className="mt-2 h-4 w-[min(360px,70%)]" />
            </div>
            <SkeletonPanel>
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-2 h-5 w-12" />
                  </div>
                ))}
              </div>
            </SkeletonPanel>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <Skeleton className="mb-5 h-7 w-56" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonPanel key={i}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }, (_, chip) => (
                    <Skeleton key={chip} className="h-8 w-24" />
                  ))}
                </div>
              </SkeletonPanel>
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonPanel key={i}>
              <Skeleton className="mb-5 h-5 w-36" />
              <SkeletonText lines={4} />
            </SkeletonPanel>
          ))}
        </aside>
      </section>
    </SkeletonGroup>
  );
}
