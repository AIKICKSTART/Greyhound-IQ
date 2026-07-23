import { Skeleton, SkeletonGroup, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading community discovery">
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[hsl(var(--card)/0.72)] p-5 sm:p-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-10 w-48 max-w-full" />
          <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl sm:w-28" />
          </div>
        </div>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonPanel key={index} className="overflow-hidden p-0">
              <div className="flex min-h-14 items-center justify-between border-b border-white/[0.06] px-4 sm:px-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-5" />
              </div>
              <div className="space-y-2 p-3 sm:p-4">
                {Array.from({ length: 2 }, (_, row) => (
                  <div
                    key={row}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.05] px-3 py-3"
                  >
                    <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </main>
    </SkeletonGroup>
  );
}
