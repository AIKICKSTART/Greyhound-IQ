import {
  Skeleton,
  SkeletonGroup,
  SkeletonHero,
  SkeletonPanel,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading race cards">
      <SkeletonHero />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SkeletonPanel>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-8 w-64" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(150px,1fr)_132px]">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-28 rounded-[10px]" />
              ))}
            </div>
          </SkeletonPanel>
          <SkeletonPanel>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-40" />
            <div className="mt-5 grid gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          </SkeletonPanel>
        </section>

        <section className="mt-10">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-56" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonPanel key={i}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="mt-2 h-3 w-16" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-10 rounded-full" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, slot) => (
                    <Skeleton key={slot} className="h-11 rounded-[6px]" />
                  ))}
                </div>
              </SkeletonPanel>
            ))}
          </div>
        </section>
      </main>
    </SkeletonGroup>
  );
}
