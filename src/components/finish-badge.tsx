import { Trophy } from "lucide-react";

// Gold/silver/bronze trophy for a podium finish; plain number otherwise.
// Shared by the dog profile and dog custom pages.
export function FinishBadge({ finish }: { finish: number | null | undefined }) {
  if (finish === 1 || finish === 2 || finish === 3) {
    const cls =
      finish === 1
        ? "giq-result-badge-gold"
        : finish === 2
          ? "giq-result-badge-silver"
          : "giq-result-badge-bronze";
    return (
      <span className={`giq-result-badge ${cls}`}>
        <Trophy className="h-3 w-3" aria-hidden="true" />
        {finish === 1 ? "1st" : finish === 2 ? "2nd" : "3rd"}
      </span>
    );
  }
  return (
    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
      {finish ?? "—"}
    </span>
  );
}
