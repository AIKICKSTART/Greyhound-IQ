import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  recordSignupAccepted,
  signupAcceptanceIdempotencyKey,
} from "./signup-acceptance";

type UpsertArgs = {
  where: { userId: string };
  create: {
    userId: string;
    idempotencyKey: string;
    correlationId: string | undefined;
  };
  update: Record<string, never>;
  select: { id: true; idempotencyKey: true; status: true };
};

const calls: UpsertArgs[] = [];
const db = {
  signupOutbox: {
    upsert: async (args: UpsertArgs) => {
      calls.push(args);
      return {
        id: "outbox_1",
        idempotencyKey: args.create.idempotencyKey,
        status: "pending",
      };
    },
  },
} as unknown as Parameters<typeof recordSignupAccepted>[0];

async function main() {
  assert.equal(
    signupAcceptanceIdempotencyKey(" user_123 "),
    "signup.accepted:user_123"
  );
  await recordSignupAccepted(db, " user_123 ");
  await recordSignupAccepted(db, "user_123");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0], {
    where: { userId: "user_123" },
    create: {
      userId: "user_123",
      idempotencyKey: "signup.accepted:user_123",
      correlationId: undefined,
    },
    update: {},
    select: { id: true, idempotencyKey: true, status: true },
  });
  assert.throws(
    () => recordSignupAccepted(db, "  "),
    /auth\.signup_acceptance_user_required/
  );
  await recordSignupAccepted(db, "user_456", "request_456");
  assert.equal(calls[2]?.create.correlationId, "request_456");
  await recordSignupAccepted(db, "user_789", "not valid request id!");
  assert.equal(calls[3]?.create.correlationId, undefined);

  const schema = readFileSync(
    new URL("../../prisma/schema.prisma", import.meta.url),
    "utf8"
  );
  const migration = readFileSync(
    new URL(
      "../../prisma/migrations/20260714004000_add_signup_acceptance_outbox/migration.sql",
      import.meta.url
    ),
    "utf8"
  );
  const authSync = readFileSync(new URL("./auth-sync.ts", import.meta.url), "utf8");
  const callback = readFileSync(
    new URL("../app/callback/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(schema, /model SignupOutbox \{/);
  assert.match(schema, /userId\s+String\s+@unique/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/);
  assert.match(migration, /SignupOutbox_status_check/);
  assert.match(migration, /SignupOutbox_userId_key/);
  assert.match(migration, /SignupOutbox_idempotencyKey_key/);
  assert.match(migration, /SignupOutbox_status_nextRetryAt_createdAt_idx/);
  assert.match(migration, /ALTER TABLE "SignupOutbox" FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY giq_signup_outbox_system/);
  assert.match(migration, /USING \(public\.giq_is_system\(\)\)/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.doesNotMatch(migration, /"email"|"payload"|"metadata"/i);

  const profileWrite = authSync.indexOf("const accepted = await ensureProfile");
  const outboxWrite = authSync.indexOf("await recordSignupAccepted");
  assert.ok(profileWrite >= 0 && outboxWrite > profileWrite);
  assert.match(authSync, /const correlationId = await getRequestId\(\)/);
  assert.match(authSync, /syncAuthUserWithClient\(tx, user, correlationId\)/);
  assert.match(authSync, /recordSignupAccepted\(db, created\.id, correlationId\)/);
  assert.match(schema, /correlationId\s+String\?\s+@db\.VarChar\(128\)/);
  assert.match(callback, /throw new Error\("auth\.local_acceptance_failed"\)/);

  console.log("signup acceptance outbox tests passed");
}

void main();
