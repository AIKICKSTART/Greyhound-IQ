import {
  Skeleton,
  SkeletonGroup,
  SkeletonHero,
  SkeletonPanel,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading tracks">
      <SkeletonHero className="max-w-[70rem] pt-8 pb-5 sm:pt-11 sm:pb-7" />
      <div className="mx-auto max-w-[70rem] px-6 pb-10 pt-2 sm:pb-11 sm:pt-4">
        <Skeleton className="h-[260px] w-full rounded-[14px]" />
      </div>
      <div className="mx-auto max-w-[70rem] px-6 pb-10 pt-2 sm:pb-11 sm:pt-4">
        <div className="mb-[18px]">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-3.5 w-56" />
        </div>
        <div className="giq-grid-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonPanel key={i} className="rounded-[14px]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-16" />
                </div>
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-11 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, slot) => (
                  <Skeleton key={slot} className="h-9 w-full" />
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
