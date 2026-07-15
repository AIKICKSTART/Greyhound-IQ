import {
  ACCOUNT_ONBOARDING_TOUR_ID,
  ADMINISTRATOR_ONBOARDING_TOUR_ID,
  MODERATOR_ONBOARDING_TOUR_ID,
} from "./onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_TOUR_ID } from "./community-onboarding-tour-registry";
import { AGENTS_ONBOARDING_TOUR_ID } from "./agents-onboarding-tour-registry";
import { DESIGN_LAB_ONBOARDING_TOUR_ID } from "./design-lab-onboarding-tour-registry";
import { MARKETPLACE_ONBOARDING_TOUR_ID } from "./marketplace-onboarding-tour-registry";
import { PUBLIC_ONBOARDING_TOUR_ID } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_TOUR_ID } from "./racing-onboarding-tour-registry";

export type DesignLabScenarioGroupId =
  | "identity"
  | "experience"
  | "resilience"
  | "guidance";

export type DesignLabScenarioKey =
  | "fixture"
  | "tier"
  | "auth"
  | "permissions"
  | "featureFlags"
  | "orientation"
  | "navigation"
  | "dataState"
  | "networkState"
  | "errorState"
  | "theme"
  | "tour"
  | "tourStep"
  | "sponsoredDemo"
  | "reducedMotion"
  | "highContrast"
  | "longContent"
  | "missingImage";

export type DesignLabScenarioOption = {
  value: string;
  label: string;
  description: string;
};

export type DesignLabScenarioDimension = {
  key: DesignLabScenarioKey;
  queryParam: string;
  label: string;
  group: DesignLabScenarioGroupId;
  defaultValue: string;
  options: readonly DesignLabScenarioOption[];
};

export const DESIGN_LAB_SCENARIO_GROUPS = [
  {
    id: "identity",
    label: "Identity and access",
    description: "Synthetic record, account, permission and feature profiles.",
  },
  {
    id: "experience",
    label: "Experience",
    description: "Device, navigation, theme and commercial presentation.",
  },
  {
    id: "resilience",
    label: "Data and resilience",
    description: "Loading, failure, network and content-stress conditions.",
  },
  {
    id: "guidance",
    label: "Guidance and accessibility",
    description: "Tours, motion and contrast review modes.",
  },
] as const satisfies readonly {
  id: DesignLabScenarioGroupId;
  label: string;
  description: string;
}[];

const BOOLEAN_OPTIONS = [
  { value: "off", label: "Off", description: "Mode disabled." },
  { value: "on", label: "On", description: "Mode enabled." },
] as const;

export const DESIGN_LAB_DATA_STATE_VALUES = [
  "default",
  "initial-loading",
  "background-refresh",
  "skeleton",
  "empty",
  "no-results",
  "partial",
  "stale",
  "delayed",
  "success",
  "optimistic",
  "mutation-pending",
  "mutation-failed",
  "long-text",
  "large-volume",
  "missing-media",
  "broken-media",
] as const;

export const DESIGN_LAB_ERROR_STATE_VALUES = [
  "none",
  "recoverable-error",
  "permission-denied",
  "auth-required",
  "subscription-required",
  "feature-disabled",
  "private",
  "blocked",
  "deleted",
  "archived",
  "suspended",
  "missing-record",
] as const;

export const DESIGN_LAB_SCENARIO_DIMENSIONS = [
  {
    key: "fixture",
    queryParam: "fixture",
    label: "Synthetic record",
    group: "identity",
    defaultValue: "dog-atlas",
    options: [
      {
        value: "dog-atlas",
        label: "Synthetic dog · Atlas",
        description: "Public demo dog D-001; no live owner data.",
      },
      {
        value: "race-harbour",
        label: "Synthetic race · Harbour Cup",
        description: "Fixed eight-runner demo race R-001.",
      },
      {
        value: "listing-starter",
        label: "Synthetic listing · Starter",
        description: "Non-purchasable marketplace demo L-001.",
      },
    ],
  },
  {
    key: "tier",
    queryParam: "tier",
    label: "Subscription tier",
    group: "identity",
    defaultValue: "free",
    options: [
      { value: "free", label: "Free", description: "Baseline access." },
      { value: "pro", label: "Pro", description: "Professional insights." },
      { value: "business", label: "Business", description: "Team and commercial tools." },
    ],
  },
  {
    key: "auth",
    queryParam: "auth",
    label: "Authentication",
    group: "identity",
    defaultValue: "signed-in",
    options: [
      { value: "signed-in", label: "Signed in", description: "Synthetic active session." },
      { value: "signed-out", label: "Signed out", description: "Anonymous review state." },
      { value: "expired", label: "Session expired", description: "Reauthentication required." },
    ],
  },
  {
    key: "permissions",
    queryParam: "permissions",
    label: "Permissions",
    group: "identity",
    defaultValue: "member",
    options: [
      { value: "none", label: "No permissions", description: "Access denied profile." },
      { value: "member", label: "Member", description: "Standard member permissions." },
      { value: "trainer", label: "Trainer", description: "Authenticated trainer guidance profile." },
      { value: "moderator", label: "Moderator / support operator", description: "Moderation and support-queue review profile." },
      { value: "admin", label: "Administrator", description: "Founder control profile." },
    ],
  },
  {
    key: "featureFlags",
    queryParam: "featureFlags",
    label: "Feature flags",
    group: "identity",
    defaultValue: "baseline",
    options: [
      { value: "baseline", label: "Baseline", description: "No optional preview flags." },
      { value: "advertising", label: "Advertising", description: "Advertising preview enabled." },
      { value: "marketplace", label: "Marketplace", description: "Marketplace preview enabled." },
      { value: "community", label: "Community", description: "Community preview enabled." },
    ],
  },
  {
    key: "orientation",
    queryParam: "orientation",
    label: "Orientation",
    group: "experience",
    defaultValue: "portrait",
    options: [
      { value: "portrait", label: "Portrait", description: "Tall review frame." },
      { value: "landscape", label: "Landscape", description: "Wide review frame." },
    ],
  },
  {
    key: "navigation",
    queryParam: "navigation",
    label: "Navigation style",
    group: "experience",
    defaultValue: "full",
    options: [
      { value: "full", label: "Full", description: "Full navigation labels." },
      { value: "compact", label: "Compact", description: "Condensed navigation." },
      { value: "minimal", label: "Minimal", description: "Essential navigation only." },
    ],
  },
  {
    key: "theme",
    queryParam: "theme",
    label: "Theme",
    group: "experience",
    defaultValue: "dark",
    options: [
      { value: "dark", label: "Dark", description: "GreyhoundIQ dark system." },
      { value: "light", label: "Light", description: "Light contrast review." },
      { value: "system", label: "System", description: "Operating-system preference." },
    ],
  },
  {
    key: "sponsoredDemo",
    queryParam: "sponsoredDemo",
    label: "Sponsored demo",
    group: "experience",
    defaultValue: "on",
    options: BOOLEAN_OPTIONS,
  },
  {
    key: "dataState",
    queryParam: "state",
    label: "Data state",
    group: "resilience",
    defaultValue: "default",
    options: DESIGN_LAB_DATA_STATE_VALUES.map((value) => ({
      value,
      label: labelFromValue(value),
      description: `Synthetic ${value} presentation.`,
    })),
  },
  {
    key: "networkState",
    queryParam: "networkState",
    label: "Network state",
    group: "resilience",
    defaultValue: "online",
    options: [
      { value: "online", label: "Online", description: "Normal network state." },
      { value: "offline", label: "Offline", description: "Offline recovery state." },
      { value: "slow", label: "Slow network", description: "Delayed response simulation." },
    ],
  },
  {
    key: "errorState",
    queryParam: "errorState",
    label: "Error and access state",
    group: "resilience",
    defaultValue: "none",
    options: DESIGN_LAB_ERROR_STATE_VALUES.map((value) => ({
      value,
      label: labelFromValue(value),
      description:
        value === "none" ? "No error state." : `Synthetic ${value} presentation.`,
    })),
  },
  {
    key: "longContent",
    queryParam: "longContent",
    label: "Long-content stress",
    group: "resilience",
    defaultValue: "off",
    options: BOOLEAN_OPTIONS,
  },
  {
    key: "missingImage",
    queryParam: "missingImage",
    label: "Missing-image mode",
    group: "resilience",
    defaultValue: "off",
    options: BOOLEAN_OPTIONS,
  },
  {
    key: "tour",
    queryParam: "tour",
    label: "Onboarding tour",
    group: "guidance",
    defaultValue: "off",
    options: [
      { value: "off", label: "Off", description: "No tour overlay." },
      { value: "getting-started", label: "Getting started", description: "Member orientation tour." },
      { value: "marketplace", label: "Marketplace", description: "Seller and buyer tour." },
      { value: "safety", label: "Safety", description: "Responsible-use tour." },
      {
        value: MODERATOR_ONBOARDING_TOUR_ID,
        label: "Moderator operations",
        description: "Role-aware moderator route guidance.",
      },
      {
        value: ADMINISTRATOR_ONBOARDING_TOUR_ID,
        label: "Administrator operations",
        description: "Role-aware administrator route guidance.",
      },
      {
        value: ACCOUNT_ONBOARDING_TOUR_ID,
        label: "Account workspace",
        description: "Authenticated account-route guidance.",
      },
      {
        value: RACING_ONBOARDING_TOUR_ID,
        label: "Racing intelligence",
        description: "Public and member racing-route guidance.",
      },
      {
        value: COMMUNITY_ONBOARDING_TOUR_ID,
        label: "Community and Pulse",
        description: "Public-read and member-action community guidance.",
      },
      {
        value: PUBLIC_ONBOARDING_TOUR_ID,
        label: "Public foundations",
        description: "Visitor, member and operator public-route guidance.",
      },
      {
        value: MARKETPLACE_ONBOARDING_TOUR_ID,
        label: "Marketplace",
        description: "Buyer, seller and isolated template-review guidance.",
      },
      {
        value: AGENTS_ONBOARDING_TOUR_ID,
        label: "AI agents",
        description: "Authenticated agent-workspace guidance.",
      },
      {
        value: DESIGN_LAB_ONBOARDING_TOUR_ID,
        label: "Design Lab",
        description: "Founder-control and synthetic-review guidance.",
      },
    ],
  },
  {
    key: "tourStep",
    queryParam: "tourStep",
    label: "Tour step",
    group: "guidance",
    defaultValue: "1",
    options: ["1", "2", "3", "4", "5"].map((value) => ({
      value,
      label: `Step ${value}`,
      description: `Synthetic onboarding step ${value}.`,
    })),
  },
  {
    key: "reducedMotion",
    queryParam: "reducedMotion",
    label: "Reduced motion",
    group: "guidance",
    defaultValue: "off",
    options: BOOLEAN_OPTIONS,
  },
  {
    key: "highContrast",
    queryParam: "highContrast",
    label: "High contrast",
    group: "guidance",
    defaultValue: "off",
    options: BOOLEAN_OPTIONS,
  },
] as const satisfies readonly DesignLabScenarioDimension[];

export const DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES = [
  ...DESIGN_LAB_DATA_STATE_VALUES,
  ...DESIGN_LAB_ERROR_STATE_VALUES.filter((value) => value !== "none"),
  "offline",
] as const;

export function labelFromValue(value: string) {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
