import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("giq-skeleton", className)} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3"];
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("giq-skeleton h-3.5", widths[i % widths.length])} />
      ))}
    </div>
  );
}

export function SkeletonPanel({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div aria-hidden="true" className={cn("giq-panel p-5", className)}>
      {children}
    </div>
  );
}

export function SkeletonHero({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("mx-auto max-w-7xl px-6 pt-14 pb-10", className)}>
      <div className="giq-skeleton h-6 w-40 rounded-full" />
      <div className="mt-6 giq-skeleton h-12 w-[min(560px,80%)]" />
      <div className="mt-3 giq-skeleton h-12 w-[min(420px,60%)]" />
      <div className="mt-6 giq-skeleton h-4 w-[min(520px,75%)]" />
    </div>
  );
}

export function SkeletonGroup({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}
