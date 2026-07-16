import { DatabaseZap } from "lucide-react";

export function RacingDataEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="giq-panel flex min-h-36 items-center justify-center p-8 text-center"
      role="status"
      data-racing-data-state="unavailable"
    >
      <div className="max-w-lg">
        <DatabaseZap
          className="mx-auto mb-3 h-5 w-5 text-[hsl(var(--muted-foreground))]"
          aria-hidden="true"
        />
        <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      </div>
    </div>
  );
}
