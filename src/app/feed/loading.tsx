import {
  Skeleton,
  SkeletonGroup,
  SkeletonPanel,
  SkeletonText,
} from "@/components/skeleton";

export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-5 lg:px-6">
      <SkeletonGroup
        label="Loading your feed"
        className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px]"
      >
        <div className="hidden space-y-4 lg:block">
          <SkeletonPanel>
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 space-y-2.5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </SkeletonPanel>
          <SkeletonPanel>
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          </SkeletonPanel>
        </div>

        <div className="min-w-0 space-y-4">
          <SkeletonPanel className="overflow-hidden p-0">
            <Skeleton className="aspect-[16/4] w-full rounded-none sm:aspect-[16/3]" />
            <div className="flex items-end gap-4 px-5 pb-4">
              <Skeleton className="-mt-9 h-[72px] w-[72px] shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2 pb-1">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
          </SkeletonPanel>
          <SkeletonPanel>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-4 h-24 w-full rounded-lg" />
          </SkeletonPanel>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonPanel key={i}>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <SkeletonText className="mt-4" lines={3} />
            </SkeletonPanel>
          ))}
        </div>

        <div className="hidden space-y-4 lg:block">
          <SkeletonPanel>
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          </SkeletonPanel>
          <SkeletonPanel>
            <Skeleton className="h-4 w-16" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          </SkeletonPanel>
        </div>
      </SkeletonGroup>
    </div>
  );
}
