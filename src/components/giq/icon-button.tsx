import * as React from "react";

import { Button, type GiqButtonVariant } from "./button";
import { cn } from "./utils";

export function IconButton({
  icon,
  label,
  variant = "carbon",
  size = "md",
  active = false,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: React.ReactNode;
  label: string;
  variant?: GiqButtonVariant;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const dims = {
    sm: "h-11 min-h-11 w-11",
    md: "h-11 min-h-11 w-11",
    lg: "h-12 min-h-12 w-12",
  }[size];

  return (
    <Button
      type="button"
      variant={active ? "primary" : variant}
      size="sm"
      aria-label={label}
      title={label}
      className={cn("px-0", dims, className)}
      {...props}
    >
      <span aria-hidden="true" className="relative z-[1] inline-flex">
        {icon}
      </span>
    </Button>
  );
}
