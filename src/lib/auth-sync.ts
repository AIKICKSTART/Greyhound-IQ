import {
  withDbSystemContext,
  type DbContextClient,
} from "@/lib/db-context";
import { personalActorHandle } from "@/lib/social-actor-service";

export interface AuthIdentity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
}

export async function syncAuthUser(user: AuthIdentity) {
  return withDbSystemContext((tx) => syncAuthUserWithClient(tx, user));
}

async function syncAuthUserWithClient(
  db: DbContextClient,
  user: AuthIdentity
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
    return ensureProfile(db, created, displayName);
  }

  if (existing.isBanned && !existing.deletionRequestedAt) {
    return existing;
  }

  const wasDeletionPending = Boolean(
    existing.isBanned && existing.deletionRequestedAt
  );
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

  return ensureProfile(db, dbUser, displayName);
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
