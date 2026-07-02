import * as React from "react";

import { cn } from "./utils";

export type GiqButtonVariant =
  | "primary"
  | "gold"
  | "glass"
  | "chrome"
  | "carbon"
  | "graphite"
  | "liquid-purple";

export type GiqButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<GiqButtonVariant, string> = {
  primary: "giq-button giq-button-primary",
  gold: "giq-button giq-button-gold",
  glass: "giq-button giq-button-glass",
  chrome: "giq-button giq-button-chrome",
  carbon: "giq-button giq-button-carbon",
  graphite: "giq-button",
  "liquid-purple": "giq-liquid-purple-button",
};

const sizeClasses: Record<GiqButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-[14px]",
  lg: "min-h-[52px] px-6 text-[15px]",
};

type ButtonOwnProps = {
  as?: React.ElementType;
  variant?: GiqButtonVariant;
  size?: GiqButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export type GiqButtonProps<C extends React.ElementType = "button"> =
  ButtonOwnProps &
    Omit<React.ComponentPropsWithoutRef<C>, keyof ButtonOwnProps | "as">;

export function giqButtonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: GiqButtonVariant;
  size?: GiqButtonSize;
  className?: string;
}) {
  return cn(
    variantClasses[variant],
    sizeClasses[size],
    "font-semibold tracking-[-0.013em]",
    className
  );
}

export function Button<C extends React.ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  disabled = false,
  className,
  children,
  ...rest
}: GiqButtonProps<C>) {
  const Component = as ?? "button";
  const props = {
    ...rest,
    className: giqButtonClassName({ variant, size, className }),
    "aria-disabled": disabled || undefined,
    disabled: Component === "button" ? disabled : undefined,
  } as React.ComponentPropsWithoutRef<C>;

  return (
    <Component {...props}>
      {iconLeft ? (
        <span aria-hidden="true" className="relative z-[1] inline-flex">
          {iconLeft}
        </span>
      ) : null}
      {children ? <span className="relative z-[1]">{children}</span> : null}
      {iconRight ? (
        <span aria-hidden="true" className="relative z-[1] inline-flex">
          {iconRight}
        </span>
      ) : null}
    </Component>
  );
}
