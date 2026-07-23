"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

export function AdminSubmitButton({
  label,
  pendingLabel = "Saving…",
  confirmMessage,
  disabled,
  onClick,
  type = "submit",
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 ${className ?? ""}`}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          confirmMessage &&
          !window.confirm(confirmMessage)
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
