import type { DockActionKey } from "@/components/dock-skin-catalogue";

export function buildPrototypeDemoHref(
  currentSearch: string,
  changes: { dock?: string; variant?: string } = {}
) {
  const current = new URLSearchParams(currentSearch);
  const params = new URLSearchParams();
  for (const [key, pattern] of [
    ["variant", /^(?:A|B|C)[12]$/],
    ["demo", /^1$/],
    ["dock", /^D[1-6]$/],
    ["sponsored", /^(?:on|off)$/],
  ] as const) {
    const value = current.get(key);
    if (value && pattern.test(value)) params.set(key, value);
  }
  params.set("demo", "1");
  if (changes.variant && /^(?:A|B|C)[12]$/.test(changes.variant)) {
    params.set("variant", changes.variant);
  }
  if (changes.dock && /^D[1-6]$/.test(changes.dock)) {
    params.set("dock", changes.dock);
  }
  if (!params.has("sponsored")) params.set("sponsored", "on");
  return `/feed?${params.toString()}`;
}

export function prototypeDockDestination(
  action: DockActionKey,
  currentSearch: string
) {
  if (action === "home") return "/";
  if (action === "feed") return buildPrototypeDemoHref(currentSearch);
  if (action === "chat") return "/pulse";
  return null;
}
