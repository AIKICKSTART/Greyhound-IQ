import type { Tier } from "@/lib/tier-access";
import type { MessengerLayout } from "@/lib/messenger-layout";

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
  messengerLayout?: MessengerLayout;
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
