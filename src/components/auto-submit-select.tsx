"use client";

import type { ChangeEventHandler, SelectHTMLAttributes } from "react";

type AutoSubmitSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "aria-label" | "onChange"
> & {
  "aria-label": string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
};

export function AutoSubmitSelect({
  onChange,
  "aria-label": ariaLabel,
  ...props
}: AutoSubmitSelectProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onChange?.(event);
    if (!event.defaultPrevented) event.currentTarget.form?.requestSubmit();
  };

  return (
    <select
      {...props}
      aria-label={ariaLabel}
      data-auto-submit-select
      onChange={handleChange}
    />
  );
}
