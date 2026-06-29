import { withAuth } from "@workos-inc/authkit-nextjs";
import {
  displayNameForAuth,
  findUserForAuth,
  syncAuthUser,
} from "@/lib/auth-sync";
import { prisma, safeQuery } from "@/lib/db";

// Subscription tiers, ordered. Pricing: Free / Pro ($12) / Pro+ ($29).
export type Tier = "free" | "pro" | "pro_plus";

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, pro_plus: 2 };

export function normalizeTier(value?: string | null): Tier {
  if (value === "pro" || value === "pro_plus") return value;
  return "free";
}

// True when the user's tier meets or exceeds the required minimum.
export function hasTier(userTier: string | null | undefined, min: Tier): boolean {
  return TIER_RANK[normalizeTier(userTier)] >= TIER_RANK[min];
}

export interface CurrentUser {
  id: string;
  dbUserId: string | null;
  profileId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  tier: Tier;
  role: string | null;
  isBanned: boolean;
  deletionRequestedAt: Date | null;
}

export interface CurrentUserProfile extends CurrentUser {
  dbUserId: string;
  profileId: string;
  displayName: string;
  profileRole: string;
  verified: boolean;
}

// Bridges the WorkOS session to the local User row that carries the
// subscription tier. Returns null when no user is signed in.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { user } = await withAuth();
  if (!user) return null;

  const dbUser = await safeQuery(
    () => findUserForAuth(user.id, user.email),
    null
  );

  const name = displayNameForAuth(user);

  return {
    id: user.id,
    dbUserId: dbUser?.id ?? null,
    profileId: dbUser?.profile?.id ?? null,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name,
    tier: normalizeTier(dbUser?.subscriptionTier),
    role: dbUser?.profile?.role ?? null,
    isBanned: dbUser?.isBanned ?? false,
    deletionRequestedAt: dbUser?.deletionRequestedAt ?? null,
  };
}

export async function requireCurrentUserProfile(): Promise<CurrentUserProfile> {
  const { user } = await withAuth();
  if (!user) {
    throw new Error("auth.unauthorized");
  }

  const displayName = displayNameForAuth(user);
  const dbUser = await syncAuthUser(user);
  if (dbUser.isBanned) {
    throw new Error("auth.forbidden");
  }

  const profile =
    dbUser.profile ??
    (await prisma.profile.create({
      data: {
        userId: dbUser.id,
        displayName,
        role: "member",
      },
    }));

  return {
    id: user.id,
    dbUserId: dbUser.id,
    profileId: profile.id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name: displayName,
    tier: normalizeTier(dbUser.subscriptionTier),
    role: profile.role,
    isBanned: dbUser.isBanned,
    deletionRequestedAt: dbUser.deletionRequestedAt,
    displayName: profile.displayName,
    profileRole: profile.role,
    verified: profile.verified,
  };
}

export function isModeratorRole(role: string | null | undefined) {
  return role === "admin" || role === "moderator";
}

export async function requireModeratorProfile(): Promise<CurrentUserProfile> {
  const current = await requireCurrentUserProfile();
  if (!isModeratorRole(current.profileRole)) {
    throw new Error("auth.forbidden");
  }
  return current;
}
