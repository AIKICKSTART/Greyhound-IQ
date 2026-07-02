import { Skeleton, SkeletonGroup, SkeletonHero, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading messages">
      <SkeletonHero />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-6">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-2 h-4 w-52" />
            </div>
            <SkeletonPanel className="p-0">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-start gap-4 border-b border-white/[0.05] p-5 last:border-0">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-3.5 w-4/5" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </SkeletonPanel>
          </div>

          <aside>
            <SkeletonPanel>
              <div className="mb-5 flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-[10px]" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-36 w-full rounded-[10px]" />
                <Skeleton className="h-10 w-full rounded-[10px]" />
              </div>
            </SkeletonPanel>
          </aside>
        </div>
      </section>
    </SkeletonGroup>
  );
}
