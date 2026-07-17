import type { Metadata } from "next";

import { DesignLabRoleBlueprintPreview } from "@/components/design-lab-role-blueprint-preview";
import { isDesignLabRole } from "@/components/design-lab-role-blueprints";
import { isPrototypeVariant } from "@/components/prototype-variants";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

export const metadata: Metadata = {
  title: "Role Blueprint Lab - GreyhoundIQ",
  description:
    "Review Business, Trainer, Owner and Punter dashboard priorities across the GreyhoundIQ A1-C2 app templates.",
  robots: { index: false, follow: false },
};

type RoleBlueprintSearchParams = {
  role?: string | string[];
  variant?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RoleBlueprintDesignLabPage({
  searchParams,
}: {
  searchParams: Promise<RoleBlueprintSearchParams>;
}) {
  await requireDesignLabReviewer();

  const resolved = await searchParams;
  const requestedRole = firstValue(resolved.role);
  const requestedVariant = firstValue(resolved.variant);
  const role = isDesignLabRole(requestedRole) ? requestedRole : "business";
  const variant = isPrototypeVariant(requestedVariant)
    ? requestedVariant
    : "A1";

  return (
    <>
      <style>{`
        body:has([data-role-blueprint-lab]) .giq-site-header,
        body:has([data-role-blueprint-lab]) .giq-member-header,
        body:has([data-role-blueprint-lab]) .giq-mobile-dock,
        body:has([data-role-blueprint-lab]) .giq-hub-conversation-dock,
        body:has([data-role-blueprint-lab]) .giq-footer-shell,
        body:has([data-role-blueprint-lab]) .giq-alert-wrap {
          display: none !important;
        }
      `}</style>
      <DesignLabRoleBlueprintPreview role={role} variant={variant} />
    </>
  );
}
