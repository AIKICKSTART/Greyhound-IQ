import { Skeleton, SkeletonGroup, SkeletonHero, SkeletonPanel } from "@/components/skeleton";

const BAR_HEIGHTS = ["h-36", "h-44", "h-32", "h-40", "h-28", "h-36", "h-32", "h-40"];

export default function Loading() {
  return (
    <SkeletonGroup label="Loading statistics">
      <SkeletonHero className="flex min-h-[420px] flex-col justify-center" />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Skeleton className="mb-6 h-7 w-72" />
        <Skeleton className="mb-8 h-4 w-[min(460px,90%)]" />
        <SkeletonPanel className="p-8">
          <div className="grid min-h-[240px] grid-cols-8 items-end gap-3">
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className={`w-full ${h}`} />
                <Skeleton className="h-7 w-7" />
              </div>
            ))}
          </div>
          <Skeleton className="mx-auto mt-6 h-3 w-64" />
        </SkeletonPanel>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-20">
        <Skeleton className="mb-6 h-7 w-64" />
        <Skeleton className="mb-6 h-4 w-[min(380px,90%)]" />
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
    </SkeletonGroup>
  );
}
