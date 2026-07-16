import { isFullAccessDemo } from "@/lib/demo-access";

export const DANIEL_DEMO_PROFILE_PORTRAIT =
  "/images/feed/daniel-fleuren-founder-portrait.png";

export const DANIEL_DEMO_PROFILE_ALIGNMENT = {
  focalX: 0.52,
  focalY: 0.3,
  zoom: 1.28,
} as const;

export const GENERATED_DEMO_PROFILE_PORTRAITS = {
  "Freddie Free": "/images/demo-profiles/freddie-free.webp",
  "Patricia Pro": "/images/demo-profiles/patricia-pro.webp",
  "Quentin Quant": "/images/demo-profiles/quentin-quant.webp",
  "Sarah Thompson": "/images/demo-profiles/sarah-thompson.webp",
  "Mark Riley": "/images/demo-profiles/mark-riley.webp",
  "Lisa Grant": "/images/demo-profiles/lisa-grant.webp",
  "James Cole": "/images/demo-profiles/james-cole.webp",
  "Ava Martinez": "/images/demo-profiles/ava-martinez.webp",
  "Joel Nguyen": "/images/demo-profiles/joel-nguyen.webp",
  "Priya Shah": "/images/demo-profiles/priya-shah.webp",
  "Ben Callaghan": "/images/demo-profiles/ben-callaghan.webp",
  "Mia Lawson": "/images/demo-profiles/mia-lawson.webp",
  "Emma Reed": "/images/demo-profiles/emma-reed.webp",
} as const;

export const DEMO_PROFILE_PORTRAITS = {
  "Daniel Fleuren": DANIEL_DEMO_PROFILE_PORTRAIT,
  ...GENERATED_DEMO_PROFILE_PORTRAITS,
} as const;

export type DemoProfileName = keyof typeof DEMO_PROFILE_PORTRAITS;

function normalizeProfileName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function demoProfilePortraitForName(name: string | null | undefined) {
  if (!name) return null;
  const normalized = normalizeProfileName(name);
  for (const [displayName, portrait] of Object.entries(DEMO_PROFILE_PORTRAITS)) {
    if (normalizeProfileName(displayName) === normalized) return portrait;
  }
  return null;
}

export function resolveDemoProfilePortrait(
  name: string | null | undefined,
  avatarUrl: string | null | undefined,
  fullAccessDemo = isFullAccessDemo(),
) {
  if (avatarUrl || !fullAccessDemo) return avatarUrl ?? null;
  return demoProfilePortraitForName(name);
}
