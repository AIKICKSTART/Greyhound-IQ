"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({
  children,
  pendingLabel = "Saving...",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md bg-[hsl(142_60%_42%)] px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-[hsl(142_76%_36%/0.18)] transition-colors hover:bg-[hsl(142_60%_48%)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
