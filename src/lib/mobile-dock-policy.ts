import { normalizeTier } from "@/lib/tier-access";

export type DockLinkActivation = {
  href: string;
  tone?: "pro" | "create";
};

export function isDockLinkActive(
  pathname: string,
  hash: string,
  item: DockLinkActivation,
) {
  if (item.tone === "create") {
    return pathname === "/feed" && hash === "#feed-composer";
  }
  if (
    item.href === "/feed" &&
    pathname === "/feed" &&
    hash === "#feed-composer"
  ) {
    return false;
  }
  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  );
}

export function subscriptionDockDestinationForTier(
  tier: string | null | undefined,
) {
  const normalized = normalizeTier(tier);
  if (normalized === "pro_plus") {
    return { href: "/agents", label: "Tips" } as const;
  }
  if (normalized === "pro") {
    return { href: "/account/pages", label: "Pages" } as const;
  }
  return { href: "/pricing", label: "Upgrade" } as const;
}
