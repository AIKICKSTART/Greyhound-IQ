import type { DbContextClient } from "@/lib/db-context";
import { isAdminRole, isModeratorRole } from "@/lib/auth-roles";

const MODERATOR_REPORT_BAN_TARGET_ROLES = new Set([
  "member",
  "breeder",
  "trainer",
]);

export function lockAdminAccessChanges(tx: DbContextClient) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('greyhoundiq:admin-access-update'))`;
}

export function assertAdminSelfAccessChange({
  actingUserId,
  targetUserId,
  nextRole,
  banned,
}: {
  actingUserId: string;
  targetUserId: string;
  nextRole: string | null | undefined;
  banned: boolean;
}) {
  if (actingUserId !== targetUserId) return;
  if (nextRole !== "admin" || banned) {
    throw new Error("admin.self_lockout_forbidden");
  }
}

export function assertLastAdminAccessChange({
  targetCurrentRole,
  targetCurrentlyActive,
  nextRole,
  nextBanned,
  activeAdminCount,
}: {
  targetCurrentRole: string | null | undefined;
  targetCurrentlyActive: boolean;
  nextRole: string | null | undefined;
  nextBanned: boolean;
  activeAdminCount: number;
}) {
  const removesActiveAdministrator =
    targetCurrentRole === "admin" &&
    targetCurrentlyActive &&
    (nextRole !== "admin" || nextBanned);

  if (removesActiveAdministrator && activeAdminCount <= 1) {
    throw new Error("admin.last_admin_forbidden");
  }
}

export function assertReportUserBanAllowed({
  actingUserId,
  actingRole,
  actingCurrentlyActive,
  targetUserId,
  targetCurrentRole,
  targetCurrentlyActive,
  activeAdminCount,
}: {
  actingUserId: string;
  actingRole: string | null | undefined;
  actingCurrentlyActive: boolean;
  targetUserId: string;
  targetCurrentRole: string | null | undefined;
  targetCurrentlyActive: boolean;
  activeAdminCount: number;
}) {
  if (!actingCurrentlyActive || !isModeratorRole(actingRole)) {
    throw new Error("auth.forbidden");
  }

  assertAdminSelfAccessChange({
    actingUserId,
    targetUserId,
    nextRole: targetCurrentRole,
    banned: true,
  });
  if (
    !isAdminRole(actingRole) &&
    (targetCurrentRole == null ||
      !MODERATOR_REPORT_BAN_TARGET_ROLES.has(targetCurrentRole))
  ) {
    throw new Error("auth.forbidden");
  }
  assertLastAdminAccessChange({
    targetCurrentRole,
    targetCurrentlyActive,
    nextRole: targetCurrentRole,
    nextBanned: true,
    activeAdminCount,
  });
}
