"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { cn } from "@/lib/utils";

type LinkProps = ComponentPropsWithoutRef<typeof Link>;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type FormProps = ComponentPropsWithoutRef<"form">;
type MobileMenuLinkProps = LinkProps & {
  activeClassName?: string;
};

function closeContainingSheet(target: HTMLElement) {
  const closeButton = target
    .closest('[data-slot="sheet-content"]')
    ?.querySelector<HTMLElement>('[data-slot="sheet-close"]');

  window.setTimeout(() => closeButton?.click(), 0);
}

function isActivePath(pathname: string, href: LinkProps["href"]) {
  if (typeof href !== "string") return false;
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileMenuLink({
  activeClassName = "is-active",
  className,
  href,
  onClick,
  ...props
}: MobileMenuLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (!event.defaultPrevented) {
      closeContainingSheet(event.currentTarget);
    }
  }

  return (
    <Link
      {...props}
      href={href}
      aria-current={active ? "page" : props["aria-current"]}
      className={cn(className, active && activeClassName)}
      onClick={handleClick}
    />
  );
}

export function MobileMenuAnchor({ onClick, ...props }: AnchorProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (!event.defaultPrevented) {
      closeContainingSheet(event.currentTarget);
    }
  }

  return <a {...props} onClick={handleClick} />;
}

export function MobileMenuSearchForm({ onSubmit, ...props }: FormProps) {
  function handleSubmit(event: Parameters<NonNullable<FormProps["onSubmit"]>>[0]) {
    onSubmit?.(event);

    if (!event.defaultPrevented) {
      closeContainingSheet(event.currentTarget);
    }
  }

  return <form {...props} onSubmit={handleSubmit} />;
}
