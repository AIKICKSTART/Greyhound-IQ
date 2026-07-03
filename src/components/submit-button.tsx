"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
      aria-busy={pending}
      className={cn(
        className ??
          "giq-button giq-button-primary px-4 text-[13px] font-semibold disabled:cursor-not-allowed",
        "giq-submit-stack"
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
          pending && "invisible"
        )}
      >
        {children}
      </span>
      <span
        aria-hidden={!pending}
        className={cn(
          "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
          !pending && "invisible"
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {pendingLabel}
      </span>
      <span role="status" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
    </button>
  );
}
