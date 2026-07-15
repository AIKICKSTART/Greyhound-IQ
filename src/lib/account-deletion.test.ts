import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accountDeletionAuthoredMessageUpdate,
  accountStorageDeletionJobsForUser,
  accountStoragePrefix,
  deleteAccountStoragePrefixBatch,
  parseAccountStorageDeletionJob,
} from "./account-service";

const now = new Date("2026-07-13T00:00:00.000Z");
const accountServiceSource = readFileSync(join(__dirname, "account-service.ts"), "utf8");
assert.doesNotMatch(accountServiceSource, /@\/lib\/supabase-storage/);
assert.match(accountServiceSource, /objectStorage\.listObjectKeys/);
assert.match(accountServiceSource, /objectStorage\.deleteObjects/);
const deletionRequestSource = /export async function requestAccountDeletion\([\s\S]*?(?=\nexport async function )/.exec(accountServiceSource)?.[0];
assert.ok(deletionRequestSource, "account deletion request must remain exported");
assert.match(deletionRequestSource, /lockAdminAccessChanges/);
assert.match(deletionRequestSource, /assertLastAdminAccessChange/);
assert.match(deletionRequestSource, /tx\.user\.findUnique/);
assert.match(deletionRequestSource, /target\?\.profile\?\.role === "admin"/);
const messageUpdate = accountDeletionAuthoredMessageUpdate("profile_delete", now);
assert.deepEqual(messageUpdate, {
  where: { senderId: "profile_delete" },
  data: {
    body: "This message was removed after account deletion.",
    mediaIdsJson: null,
    deletedBySenderAt: now,
  },
});
assert.equal("recipientId" in messageUpdate.where, false);
assert.equal("deletedByRecipientAt" in messageUpdate.data, false);

const job = {
  id: "job_1",
  targetType: "user_storage_prefix",
  targetUserId: "user_1",
  storageBucket: "private-user-media",
  storagePath: accountStoragePrefix("user_1"),
};
assert.deepEqual(parseAccountStorageDeletionJob(job), {
  bucket: "private-user-media",
  prefix: "users/user_1",
});
assert.throws(
  () => parseAccountStorageDeletionJob({ ...job, storagePath: "users/other" }),
  /account\.invalid_storage_deletion_job/
);

const queuedJobs = accountStorageDeletionJobsForUser("user_1", now);
assert.deepEqual(
  queuedJobs.map(({ storageBucket, storagePath, status }) => ({
    storageBucket,
    storagePath,
    status,
  })),
  [
    {
      storageBucket: "public-user-media",
      storagePath: "users/user_1",
      status: "pending",
    },
    {
      storageBucket: "private-user-media",
      storagePath: "users/user_1",
      status: "pending",
    },
  ]
);
assert.throws(
  () => parseAccountStorageDeletionJob({ ...job, storageBucket: "site-assets" }),
  /account\.invalid_storage_deletion_job/
);

async function main() {
  const listedPaths = Array.from(
    { length: 501 },
    (_, index) => `users/user_1/processed/media_${index}/asset.webp`
  );
  let removedPaths: string[] = [];
  const batch = await deleteAccountStoragePrefixBatch(job, {
    list: async (_bucket, _prefix, maxObjects) => {
      assert.equal(maxObjects, 501);
      return listedPaths;
    },
    remove: async (_bucket, paths) => {
      removedPaths = paths;
    },
  });
  assert.equal(batch.completed, false);
  assert.equal(batch.objectsDeleted, 500);
  assert.equal(removedPaths.length, 500);

  await assert.rejects(
    () =>
      deleteAccountStoragePrefixBatch(job, {
        list: async () => ["users/other/private.bin"],
        remove: async () => undefined,
      }),
    /account\.invalid_storage_deletion_path/
  );

  console.log("account deletion regression tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
