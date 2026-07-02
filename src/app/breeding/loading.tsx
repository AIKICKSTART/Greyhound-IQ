import {
  Skeleton,
  SkeletonGroup,
  SkeletonHero,
  SkeletonPanel,
  SkeletonText,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading breeding analytics">
      <SkeletonHero className="flex min-h-[420px] flex-col justify-center" />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Skeleton className="mb-2 h-7 w-72" />
        <Skeleton className="mb-8 h-4 w-[min(340px,90%)]" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonPanel key={i} className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mb-3 h-4 w-48" />
              <SkeletonText lines={2} />
            </SkeletonPanel>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <Skeleton className="mb-1 h-7 w-56" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="giq-table-shell">
          <div className="giq-table-head p-4">
            <Skeleton className="h-3 w-2/3" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="giq-table-row flex items-center gap-4 p-4">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <Skeleton className="mx-auto mb-3 h-5 w-5" />
        <Skeleton className="mx-auto mb-3 h-6 w-56" />
        <SkeletonText lines={2} className="mx-auto max-w-xl" />
      </section>
    </SkeletonGroup>
  );
}
