import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { Storage } from "@google-cloud/storage";
import {
  assertGcsSignedUrl,
  createGoogleCloudStoragePort,
  resolveGcsBucketNames,
  type GcsBucketNames,
} from "./gcs-object-storage";
import { createObjectStorageFacade } from "./object-storage";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
} from "./storage-paths";

const buckets: GcsBucketNames = {
  [SITE_ASSETS_BUCKET]: "giq-site-assets-test",
  [PUBLIC_USER_MEDIA_BUCKET]: "giq-public-user-media-test",
  [PRIVATE_USER_MEDIA_BUCKET]: "giq-private-user-media-test",
};
const key = "users/user_1/quarantine/avatars/pending/avatar.png";
const now = Date.parse("2026-07-16T00:00:00.000Z");

type Call = { operation: string; bucket?: string; key?: string; input?: unknown };
const calls: Call[] = [];

const fakeStorage = {
  bucket(bucket: string) {
    return {
      file(objectKey: string) {
        return {
          name: objectKey,
          async getSignedUrl(input: {
            action: string;
            contentType?: string;
            extensionHeaders?: Record<string, string>;
          }) {
            calls.push({ operation: `sign-${input.action}`, bucket, key: objectKey, input });
            return [signedUrl(
              bucket,
              objectKey,
              input.contentType
                ? ["content-type", "host", ...Object.keys(input.extensionHeaders ?? {})]
                : ["host"],
            )];
          },
          async getMetadata() {
            calls.push({ operation: "metadata", bucket, key: objectKey });
            return [{ bucket, name: objectKey, size: "4" }];
          },
          createReadStream(input?: unknown) {
            calls.push({ operation: "read", bucket, key: objectKey, input });
            return Readable.from([Buffer.from([1, 2, 3, 4])]);
          },
          async save(data: Buffer, input: unknown) {
            calls.push({ operation: "save", bucket, key: objectKey, input: { data, options: input } });
          },
          async delete(input: unknown) {
            calls.push({ operation: "delete", bucket, key: objectKey, input });
            return [{}];
          },
        };
      },
      async getFiles(input: unknown) {
        calls.push({ operation: "list", bucket, input });
        return [[{ name: key }, { name: "other/not-selected.png" }]];
      },
      async upload(filePath: string, input: unknown) {
        calls.push({ operation: "upload-file", bucket, input: { filePath, options: input } });
        return [];
      },
    };
  },
} as unknown as Storage;

async function main() {
  assert.deepEqual(
    resolveGcsBucketNames({
      GCS_SITE_ASSETS_BUCKET: buckets[SITE_ASSETS_BUCKET],
      GCS_PUBLIC_USER_MEDIA_BUCKET: buckets[PUBLIC_USER_MEDIA_BUCKET],
      GCS_PRIVATE_USER_MEDIA_BUCKET: buckets[PRIVATE_USER_MEDIA_BUCKET],
    }),
    buckets,
  );
  assert.throws(
    () => resolveGcsBucketNames({ GCS_SITE_ASSETS_BUCKET: "only-one" }),
    /storage\.gcs_bucket_not_configured/,
  );
  assert.throws(
    () => resolveGcsBucketNames({
      GCS_SITE_ASSETS_BUCKET: "same-bucket",
      GCS_PUBLIC_USER_MEDIA_BUCKET: "same-bucket",
      GCS_PRIVATE_USER_MEDIA_BUCKET: "private-bucket",
    }),
    /storage\.gcs_bucket_mapping_conflict/,
  );
  assert.throws(
    () => resolveGcsBucketNames({
      GCS_SITE_ASSETS_BUCKET: "INVALID_BUCKET",
      GCS_PUBLIC_USER_MEDIA_BUCKET: "public-bucket",
      GCS_PRIVATE_USER_MEDIA_BUCKET: "private-bucket",
    }),
    /storage\.gcs_bucket_name_invalid/,
  );

  const storage = createObjectStorageFacade(createGoogleCloudStoragePort({
    storage: fakeStorage,
    bucketNames: buckets,
    now: () => now,
  }));
  assert.equal(storage.provider, "gcs");

  const upload = await storage.createSignedUpload({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    contentType: "image/png",
  });
  assert.deepEqual(upload.headers, {
    "content-type": "image/png",
    "x-goog-if-generation-match": "0",
  });
  assert.equal("x-upsert" in upload.headers, false);
  assert.equal("cache-control" in upload.headers, false);
  const uploadCall = calls.find((call) => call.operation === "sign-write");
  assert.deepEqual(uploadCall, {
    operation: "sign-write",
    bucket: buckets[PRIVATE_USER_MEDIA_BUCKET],
    key,
    input: {
      action: "write",
      contentType: "image/png",
      expires: now + 2 * 60 * 60 * 1000,
      extensionHeaders: { "x-goog-if-generation-match": "0" },
      version: "v4",
    },
  });

  const download = await storage.createSignedDownload({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    expiresInSeconds: 900,
  });
  assert.equal(new URL(download).hostname, "storage.googleapis.com");
  assert.deepEqual(
    await storage.getObjectInfo({ bucket: PRIVATE_USER_MEDIA_BUCKET, key }),
    { bucket: buckets[PRIVATE_USER_MEDIA_BUCKET], name: key, size: "4" },
  );
  assert.deepEqual(
    await storage.readObjectHead({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      bytes: 4,
    }),
    Buffer.from([1, 2, 3, 4]),
  );
  assert.deepEqual(
    Buffer.from(await new Response(await storage.streamObject({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      range: { start: 1, end: 2 },
    })).arrayBuffer()),
    Buffer.from([1, 2, 3, 4]),
  );

  const tempDir = await mkdtemp(path.join(tmpdir(), "giq-gcs-test-"));
  const destinationPath = path.join(tempDir, "download.bin");
  try {
    await storage.downloadObjectToFile({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      destinationPath,
    });
    assert.deepEqual(await readFile(destinationPath), Buffer.from([1, 2, 3, 4]));

    await storage.putObjectFromFile({
      bucket: SITE_ASSETS_BUCKET,
      key: "site/brand/logo.webp",
      filePath: destinationPath,
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  await storage.putObject({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key,
    body: new Uint8Array([1, 2, 3, 4]),
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  assert.deepEqual(
    await storage.listObjectKeys({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      prefix: "users/user_1",
      maxObjects: 10,
    }),
    [key],
  );
  await storage.deleteObject({ bucket: PRIVATE_USER_MEDIA_BUCKET, key });

  const saveCall = calls.find((call) => call.operation === "save");
  assert.deepEqual((saveCall?.input as { options: unknown }).options, {
    metadata: { contentType: "image/png", cacheControl: "31536000" },
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  assert.ok(calls.some((call) =>
    call.operation === "read" &&
    JSON.stringify(call.input) === JSON.stringify({ start: 1, end: 2 })
  ));
  assert.ok(calls.some((call) =>
    call.operation === "delete" &&
    JSON.stringify(call.input) === JSON.stringify({ ignoreNotFound: true })
  ));

  const validUrl = signedUrl(buckets[PRIVATE_USER_MEDIA_BUCKET], key, ["host"]);
  assert.equal(assertGcsSignedUrl(validUrl, buckets[PRIVATE_USER_MEDIA_BUCKET], key), validUrl);
  for (const invalid of [
    signedUrl("wrong-bucket", key, ["host"]),
    signedUrl(buckets[PRIVATE_USER_MEDIA_BUCKET], "users/other/file.png", ["host"]),
    validUrl.replace("storage.googleapis.com", "attacker.example"),
    validUrl.replace("GOOG4-RSA-SHA256", "GOOG1-RSA-SHA256"),
  ]) {
    assert.throws(
      () => assertGcsSignedUrl(invalid, buckets[PRIVATE_USER_MEDIA_BUCKET], key),
      /storage\.gcs_signed_url_invalid/,
    );
  }
  assert.throws(
    () => assertGcsSignedUrl(
      signedUrl(buckets[PRIVATE_USER_MEDIA_BUCKET], key, ["content-type", "host"]),
      buckets[PRIVATE_USER_MEDIA_BUCKET],
      key,
      ["content-type", "host", "x-goog-if-generation-match"],
    ),
    /storage\.gcs_signed_url_invalid/,
    "Upload grants must sign the create-only generation precondition",
  );

  console.log("GCS object storage tests passed");
}

function signedUrl(bucket: string, objectKey: string, signedHeaders: string[]) {
  const url = new URL(`https://storage.googleapis.com/${bucket}/${objectKey}`);
  url.searchParams.set("X-Goog-Algorithm", "GOOG4-RSA-SHA256");
  url.searchParams.set("X-Goog-Credential", "test@example.invalid/20260716/auto/storage/goog4_request");
  url.searchParams.set("X-Goog-Date", "20260716T000000Z");
  url.searchParams.set("X-Goog-Expires", "900");
  url.searchParams.set("X-Goog-SignedHeaders", [...signedHeaders].sort().join(";"));
  url.searchParams.set("X-Goog-Signature", "deadbeef");
  return url.toString();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
