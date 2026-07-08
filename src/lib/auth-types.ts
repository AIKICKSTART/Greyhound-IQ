import type { Tier } from "@/lib/tier-access";

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
