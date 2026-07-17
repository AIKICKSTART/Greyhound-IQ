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
