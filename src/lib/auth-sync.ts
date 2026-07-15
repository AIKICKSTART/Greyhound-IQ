import {
  withDbSystemContext,
  type DbContextClient,
} from "@/lib/db-context";
import { personalActorHandle } from "@/lib/social-actor-service";
import { recordSignupAccepted } from "@/lib/signup-acceptance";
import { getRequestId } from "@/lib/logger";

export interface AuthIdentity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
}

type AuthSyncOptions = {
  auditAuthenticationSuccess?: boolean;
};

type StoredAuthIdentity = {
  email: string;
  name: string | null;
  workosUserId: string | null;
};

export async function syncAuthUser(
  user: AuthIdentity,
  options: AuthSyncOptions = {},
) {
  const correlationId = await getRequestId();
  return withDbSystemContext(async (tx) => {
    const synced = await syncAuthUserWithClient(tx, user, correlationId);
    if (options.auditAuthenticationSuccess) {
      await tx.auditLog.create({
        data: {
          actorId: synced.id,
          actorType: "user",
          action: "auth.login",
          targetType: "user",
          targetId: synced.id,
          metadata: JSON.stringify({ result: "success" }),
        },
      });
    }
    return synced;
  });
}

async function syncAuthUserWithClient(
  db: DbContextClient,
  user: AuthIdentity,
  correlationId?: string,
) {
  const displayName = displayNameForAuth(user);
  const existing = await findUserForAuthWithClient(
    db,
    user.id,
    user.email,
    user.emailVerified,
  );

  if (!existing) {
    const created = await db.user.create({
      data: {
        email: user.email,
        name: displayName,
        workosUserId: user.id,
        subscriptionTier: "free",
      },
      include: { profile: true },
    });
    const accepted = await ensureProfile(db, created, displayName);
    await recordSignupAccepted(db, created.id, correlationId);
    return accepted;
  }

  if (existing.isBanned && !existing.deletionRequestedAt) {
    return existing;
  }

  const wasDeletionPending = Boolean(
    existing.isBanned && existing.deletionRequestedAt
  );
  const changedIdentityFields = authIdentityChangedFields(existing, user);
  const dbUser = await db.user.update({
    where: { id: existing.id },
    data: {
      email: user.email,
      name: displayName,
      workosUserId: user.id,
      isBanned: wasDeletionPending ? false : existing.isBanned,
      deletionRequestedAt: wasDeletionPending ? null : existing.deletionRequestedAt,
    },
    include: { profile: true },
  });

  if (wasDeletionPending) {
    await db.auditLog.create({
      data: {
        actorId: dbUser.id,
        actorType: "user",
        action: "user.delete.restore",
        targetType: "user",
        targetId: dbUser.id,
        metadata: JSON.stringify({
          restoredAt: new Date().toISOString(),
        }),
      },
    });
  }

  if (changedIdentityFields.length > 0) {
    await db.auditLog.create({
      data: {
        actorId: dbUser.id,
        actorType: "user",
        action: "auth.identity.update",
        targetType: "user",
        targetId: dbUser.id,
        metadata: JSON.stringify({ changedFields: changedIdentityFields }),
      },
    });
  }

  return ensureProfile(db, dbUser, displayName);
}

export function authIdentityChangedFields(
  existing: StoredAuthIdentity,
  user: AuthIdentity,
) {
  const changedFields: string[] = [];
  if (existing.email !== user.email) changedFields.push("email");
  if (existing.name !== displayNameForAuth(user)) {
    changedFields.push("display_name");
  }
  if (existing.workosUserId !== user.id) {
    changedFields.push("provider_subject");
  }
  return changedFields;
}

export function findUserForAuth(
  authId: string,
  email: string,
  emailVerified?: boolean,
) {
  return withDbSystemContext((tx) =>
    findUserForAuthWithClient(tx, authId, email, emailVerified)
  );
}

// Match by WorkOS subject always. Fall back to email only when the identity
// provider verified it — otherwise an unverified-email login could link into
// (and take over) an existing account that owns that email. Unknown (undefined)
// keeps the legacy email fallback for callers that don't supply the flag.
export function authLookupWhere(
  authId: string,
  email: string,
  emailVerified?: boolean,
) {
  return emailVerified === false
    ? { workosUserId: authId }
    : { OR: [{ workosUserId: authId }, { email }] };
}

function findUserForAuthWithClient(
  db: DbContextClient,
  authId: string,
  email: string,
  emailVerified?: boolean,
) {
  return db.user.findFirst({
    where: authLookupWhere(authId, email, emailVerified),
    orderBy: { createdAt: "asc" },
    include: { profile: true },
  });
}

export function displayNameForAuth(user: AuthIdentity) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

async function ensureProfile(
  db: DbContextClient,
  dbUser: NonNullable<Awaited<ReturnType<typeof findUserForAuthWithClient>>>,
  displayName: string
) {
  const profile =
    dbUser.profile ??
    (await db.profile.create({
      data: {
        userId: dbUser.id,
        displayName,
        role: "member",
      },
    }));
  await db.socialActor.upsert({
    where: { profileId: profile.id },
    create: {
      kind: "personal",
      profileId: profile.id,
      ownerProfileId: profile.id,
      handle: personalActorHandle(profile.id),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileVisibility: "members",
      contactVisibility: "only_me",
      published: true,
    },
    update: {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      published: true,
    },
  });
  return { ...dbUser, profile };
}
