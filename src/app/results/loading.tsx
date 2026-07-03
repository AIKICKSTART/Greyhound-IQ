import {
  Skeleton,
  SkeletonGroup,
  SkeletonHero,
  SkeletonPanel,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading race results">
      <SkeletonHero className="max-w-[70rem] pt-8 pb-5 sm:pt-11 sm:pb-7" />
      <div className="mx-auto max-w-[70rem] px-6 pb-10 pt-2 sm:pb-11 sm:pt-4">
        <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="mt-2 h-3.5 w-52" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-11 w-[178px] rounded-[10px]" />
            <Skeleton className="h-11 w-[168px] rounded-[10px]" />
            <Skeleton className="h-11 w-28 rounded-[10px]" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonPanel key={i} className="rounded-[14px]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-[10px]" />
                  <div>
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="mt-2 h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-7 w-32 rounded-full" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 4 }, (_, row) => (
                  <Skeleton key={row} className="h-10 w-full" />
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
