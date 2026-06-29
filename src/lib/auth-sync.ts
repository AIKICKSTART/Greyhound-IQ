import { prisma } from "@/lib/db";

export interface AuthIdentity {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function syncAuthUser(user: AuthIdentity) {
  const displayName = displayNameForAuth(user);
  const existing = await findUserForAuth(user.id, user.email);

  if (!existing) {
    return prisma.user.create({
      data: {
        email: user.email,
        name: displayName,
        supabaseUid: user.id,
        subscriptionTier: "free",
      },
      include: { profile: true },
    });
  }

  if (existing.isBanned && !existing.deletionRequestedAt) {
    return existing;
  }

  const wasDeletionPending = Boolean(
    existing.isBanned && existing.deletionRequestedAt
  );
  const dbUser = await prisma.user.update({
    where: { id: existing.id },
    data: {
      email: user.email,
      name: displayName,
      supabaseUid: user.id,
      isBanned: wasDeletionPending ? false : existing.isBanned,
      deletionRequestedAt: wasDeletionPending ? null : existing.deletionRequestedAt,
    },
    include: { profile: true },
  });

  if (wasDeletionPending) {
    await prisma.auditLog.create({
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

  return dbUser;
}

export function findUserForAuth(authId: string, email: string) {
  return prisma.user.findFirst({
    where: {
      OR: [{ supabaseUid: authId }, { email }],
    },
    orderBy: { createdAt: "asc" },
    include: { profile: true },
  });
}

export function displayNameForAuth(user: AuthIdentity) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}
