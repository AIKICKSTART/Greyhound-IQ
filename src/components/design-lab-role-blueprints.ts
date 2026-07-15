import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_VARIANTS,
  type PrototypeDevice,
  type PrototypeVariant,
} from "./prototype-variants";

export const DESIGN_LAB_ROLES = [
  {
    key: "business",
    label: "Business",
    promise: "Manage a professional racing operation from one command centre.",
    priorities: ["Team oversight", "Commercial activity", "Performance signals"],
  },
  {
    key: "trainer",
    label: "Trainer",
    promise: "Plan runners, compare form and act on race-day intelligence.",
    priorities: ["Runner readiness", "Race planning", "Kennel communication"],
  },
  {
    key: "owner",
    label: "Owner",
    promise: "Follow every dog, connection and ownership milestone in context.",
    priorities: ["Dog portfolio", "Race alerts", "Connection updates"],
  },
  {
    key: "punter",
    label: "Punter",
    promise: "Move from race discovery to an evidence-backed selection quickly.",
    priorities: ["Market movement", "Form comparison", "Betting watchlist"],
  },
] as const;

export type DesignLabRole = (typeof DESIGN_LAB_ROLES)[number]["key"];

export type RoleReviewFrameId =
  `ROLE-${Uppercase<DesignLabRole>}-${PrototypeVariant}-${Uppercase<PrototypeDevice>}`;

export type RoleReviewFrame = {
  id: RoleReviewFrameId;
  ordinal: number;
  role: DesignLabRole;
  variant: PrototypeVariant;
  device: PrototypeDevice;
  width: number;
  height: number;
  targetHref: string;
};

export function getRoleReviewFrameId(
  role: DesignLabRole,
  variant: PrototypeVariant,
  device: PrototypeDevice
): RoleReviewFrameId {
  return `ROLE-${role.toUpperCase()}-${variant}-${device.toUpperCase()}` as RoleReviewFrameId;
}

export const ROLE_REVIEW_FRAMES: readonly RoleReviewFrame[] =
  DESIGN_LAB_ROLES.flatMap((role, roleIndex) =>
    PROTOTYPE_VARIANTS.flatMap((variant, variantIndex) =>
      PROTOTYPE_DEVICES.map((device, deviceIndex) => ({
        id: getRoleReviewFrameId(role.key, variant.key, device.key),
        ordinal:
          roleIndex * PROTOTYPE_VARIANTS.length * PROTOTYPE_DEVICES.length +
          variantIndex * PROTOTYPE_DEVICES.length +
          deviceIndex +
          1,
        role: role.key,
        variant: variant.key,
        device: device.key,
        width: device.width,
        height: device.height,
        targetHref: `/design-lab/role-blueprints?role=${role.key}&variant=${variant.key}`,
      }))
    )
  );

export function isDesignLabRole(value: string | undefined): value is DesignLabRole {
  return DESIGN_LAB_ROLES.some((role) => role.key === value);
}

export function getRoleReviewFrame(
  role: DesignLabRole,
  variant: PrototypeVariant,
  device: PrototypeDevice
) {
  return ROLE_REVIEW_FRAMES.find(
    (frame) =>
      frame.role === role &&
      frame.variant === variant &&
      frame.device === device
  )!;
}
