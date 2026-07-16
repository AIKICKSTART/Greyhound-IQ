import { Skeleton, SkeletonGroup, SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonGroup label="Loading meeting details">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="sr-only">Meeting details</h1>
        <Skeleton className="h-10 w-32" />
        <SkeletonPanel className="mt-6 p-6 sm:p-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-10 w-[min(420px,80%)]" />
          <Skeleton className="mt-3 h-4 w-[min(520px,90%)]" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        </SkeletonPanel>
        <div className="mt-8 grid gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonPanel key={index} className="h-44" />
          ))}
        </div>
      </main>
    </SkeletonGroup>
  );
}
