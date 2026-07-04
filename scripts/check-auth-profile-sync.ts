import assert from "node:assert/strict";

import { findUserForAuth, syncAuthUser } from "../src/lib/auth-sync";
import { prisma } from "../src/lib/db";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const authId = `workos_auth_probe_${suffix}`;
const email = `auth-profile-probe-${suffix}@example.invalid`;

main().catch((err) => {
  console.error("Auth profile sync check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  try {
    const first = await syncAuthUser({
      id: authId,
      email,
      firstName: "Auth",
      lastName: "Probe",
    });

    assert.equal(first.email, email);
    assert.equal(first.workosUserId, authId);
    assert.ok(first.profile?.id);
    assert.equal(first.profile.displayName, "Auth Probe");

    const second = await syncAuthUser({
      id: authId,
      email,
      firstName: "Auth",
      lastName: "Probe",
    });
    assert.equal(second.id, first.id);
    assert.equal(second.profile?.id, first.profile.id);

    const found = await findUserForAuth(authId, email);
    assert.equal(found?.profile?.id, first.profile.id);

    console.log("Auth profile sync check passed");
  } finally {
    const users = await prisma.user.findMany({
      where: { OR: [{ email }, { workosUserId: authId }] },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length > 0) {
      await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}
