export const SOCIAL_AUDIENCES = [
  "public",
  "members",
  "connections",
  "only_me",
] as const;

export type SocialAudience = (typeof SOCIAL_AUDIENCES)[number];
export type SocialActorKind = "personal" | "page";

const AUDIENCE_OPENNESS: Record<SocialAudience, number> = {
  only_me: 1,
  connections: 2,
  members: 3,
  public: 4,
};

export function defaultActorVisibility(kind: SocialActorKind): SocialAudience {
  return kind === "page" ? "public" : "members";
}

export function defaultPostVisibility(kind: SocialActorKind): SocialAudience {
  return kind === "page" ? "public" : "connections";
}

export function canViewAudience(
  audience: SocialAudience,
  viewer: { authenticated: boolean; owner: boolean; connected: boolean }
) {
  if (viewer.owner) return true;
  if (audience === "public") return true;
  if (!viewer.authenticated) return false;
  if (audience === "members") return true;
  return audience === "connections" && viewer.connected;
}

export function canReshareWithoutWidening(
  source: SocialAudience,
  target: SocialAudience
) {
  return AUDIENCE_OPENNESS[target] <= AUDIENCE_OPENNESS[source];
}

export function isSocialAudience(value: string): value is SocialAudience {
  return SOCIAL_AUDIENCES.includes(value as SocialAudience);
}
