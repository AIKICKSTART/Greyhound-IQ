import { Skeleton, SkeletonGroup, SkeletonHero, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading forum">
      <SkeletonHero />

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.4fr_0.9fr]">
        <div>
          <div className="mb-5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonPanel key={i}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-[10px]" />
                    <div>
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="mt-2 h-3.5 w-64" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="mt-5 space-y-3">
                  {Array.from({ length: 3 }, (_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              </SkeletonPanel>
            ))}
          </div>
        </div>

        <aside>
          <div className="mb-5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          <SkeletonPanel className="p-4 space-y-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1">
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
