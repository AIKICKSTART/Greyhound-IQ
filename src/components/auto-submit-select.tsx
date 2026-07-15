"use client";

import type { ChangeEventHandler, SelectHTMLAttributes } from "react";

export function AutoSubmitSelect({
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onChange?.(event);
    if (!event.defaultPrevented) event.currentTarget.form?.requestSubmit();
  };

  return (
    <select {...props} data-auto-submit-select onChange={handleChange} />
  );
}
