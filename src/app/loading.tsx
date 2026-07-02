import {
  Skeleton,
  SkeletonGroup,
  SkeletonHero,
  SkeletonPanel,
  SkeletonText,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading page">
      <SkeletonHero />
      <div className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonPanel key={i} className="h-40">
              <Skeleton className="h-4 w-24" />
              <SkeletonText lines={3} className="mt-4" />
            </SkeletonPanel>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
