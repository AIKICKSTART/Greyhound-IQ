import { Skeleton, SkeletonGroup, SkeletonPanel, SkeletonText } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading dog profile" className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-3 h-4 w-80" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonPanel key={i} className="p-4 text-center">
            <Skeleton className="mx-auto h-8 w-14" />
            <Skeleton className="mx-auto mt-2 h-3 w-16" />
          </SkeletonPanel>
        ))}
      </div>

      <SkeletonPanel className="mb-6 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_280px]">
          <SkeletonPanel className="p-4">
            <SkeletonText lines={2} />
          </SkeletonPanel>
          <SkeletonPanel className="p-4">
            <SkeletonText lines={3} />
          </SkeletonPanel>
        </div>
      </SkeletonPanel>

      <SkeletonPanel className="p-0">
        <div className="border-b border-white/[0.06] p-5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-4 p-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </SkeletonPanel>
    </SkeletonGroup>
  );
}
