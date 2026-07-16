import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assertObjectStorageKey,
  createObjectStorageFacade,
  type ObjectStoragePort,
  type PutObjectInput,
} from "./object-storage";
import { resolveObjectStoragePort } from "./object-storage-provider";
import { createSupabaseObjectStoragePort } from "./supabase-object-storage";
import { PUBLIC_USER_MEDIA_BUCKET } from "./storage-paths";

const validKey = "users/user_1/custom-page/page_1/card-id.png";
const body = new Uint8Array([1, 2, 3]);

function createTestPort(
  overrides: Partial<ObjectStoragePort> = {},
): ObjectStoragePort {
  return {
    provider: "supabase",
    async createSignedUpload(input) {
      return {
        url: "https://storage.invalid/upload",
        token: null,
        key: input.key,
        headers: { "content-type": input.contentType },
      };
    },
    async createSignedDownload() {
      return "https://storage.invalid/download";
    },
    async getObjectInfo() {
      return { size: 3 };
    },
    async readObjectHead() {
      return body;
    },
    async streamObject() {
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
    },
    async downloadObjectToFile() {},
    async listObjectKeys() {
      return [];
    },
    async putObject() {},
    async putObjectFromFile() {},
    async deleteObjects() {},
    ...overrides,
  };
}

async function main() {
  const providerCalls: Array<
    | { operation: "put"; input: PutObjectInput }
    | { operation: "delete"; keys: readonly string[] }
  > = [];
  const port = createTestPort({
    async putObject(input) {
      providerCalls.push({ operation: "put", input });
    },
    async deleteObjects(input) {
      providerCalls.push({ operation: "delete", keys: input.keys });
    },
  });
  const storage = createObjectStorageFacade(port);

  await storage.putObject({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    body,
    contentType: "image/png",
    upsert: false,
  });
  await storage.deleteObject({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
  });
  await storage.deleteObjects({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    keys: [validKey, "users/user_1/second.png"],
  });
  await storage.deleteObjects({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    keys: [],
  });

  assert.deepEqual(providerCalls, [
    {
      operation: "put",
      input: {
        bucket: PUBLIC_USER_MEDIA_BUCKET,
        key: validKey,
        body,
        contentType: "image/png",
        upsert: false,
      },
    },
    { operation: "delete", keys: [validKey] },
    {
      operation: "delete",
      keys: [validKey, "users/user_1/second.png"],
    },
  ]);

  const callsBeforeInvalidKeys = providerCalls.length;
  for (const invalidKey of [
    "",
    "/leading.png",
    "trailing.png/",
    "users//double.png",
    "users/./dot.png",
    "users/../traversal.png",
    "users\\windows.png",
    "users/control\u0000.png",
    "users/control\n.png",
    "a".repeat(1025),
  ]) {
    assert.throws(
      () => assertObjectStorageKey(invalidKey),
      /storage\.invalid_object_key/,
    );
    await assert.rejects(
      storage.putObject({
        bucket: PUBLIC_USER_MEDIA_BUCKET,
        key: invalidKey,
        body,
        contentType: "image/png",
        upsert: false,
      }),
      /storage\.invalid_object_key/,
    );
    await assert.rejects(
      storage.deleteObject({
        bucket: PUBLIC_USER_MEDIA_BUCKET,
        key: invalidKey,
      }),
      /storage\.invalid_object_key/,
    );
  }
  assert.equal(providerCalls.length, callsBeforeInvalidKeys);

  await assert.rejects(
    storage.putObject({
      bucket: "unknown-bucket" as typeof PUBLIC_USER_MEDIA_BUCKET,
      key: validKey,
      body,
      contentType: "image/png",
      upsert: false,
    }),
    /storage\.invalid_bucket/,
  );
  assert.equal(providerCalls.length, callsBeforeInvalidKeys);

  const uploadFailure = new Error("storage.upload_failed:provider rejected");
  const failingStorage = createObjectStorageFacade(createTestPort({
    async putObject() {
      throw uploadFailure;
    },
    async deleteObjects() {
      throw new Error("unexpected delete");
    },
  }));
  await assert.rejects(
    failingStorage.putObject({
      bucket: PUBLIC_USER_MEDIA_BUCKET,
      key: validKey,
      body,
      contentType: "image/png",
      upsert: false,
    }),
    (error) => error === uploadFailure,
  );

  const deleteFailure = new Error("storage.delete_failed:provider rejected");
  const failingDeleteStorage = createObjectStorageFacade(createTestPort({
    async putObject() {
      throw new Error("unexpected upload");
    },
    async deleteObjects() {
      throw deleteFailure;
    },
  }));
  await assert.rejects(
    failingDeleteStorage.deleteObject({
      bucket: PUBLIC_USER_MEDIA_BUCKET,
      key: validKey,
    }),
    (error) => error === deleteFailure,
  );

  let uploadArguments: unknown[] | undefined;
  let removeArguments: unknown[] | undefined;
  const adapter = createSupabaseObjectStoragePort({
    async uploadObject(...args) {
      uploadArguments = args;
      return {
        id: "provider-object-id",
        path: args[1],
        fullPath: `${args[0]}/${args[1]}`,
      };
    },
    async removeObjects(...args) {
      removeArguments = args;
    },
  });
  await adapter.putObject({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    body,
    contentType: "image/png",
    upsert: false,
  });
  await adapter.deleteObjects({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    keys: [validKey],
  });
  assert.deepEqual(uploadArguments, [
    PUBLIC_USER_MEDIA_BUCKET,
    validKey,
    body,
    "image/png",
    { cacheControl: null, upsert: false },
  ]);
  assert.deepEqual(removeArguments, [PUBLIC_USER_MEDIA_BUCKET, [validKey]]);

  const supabasePort = createTestPort();
  const gcsCalls: string[] = [];
  const gcsPort = createTestPort({
    provider: "gcs",
    async createSignedUpload(input) {
      gcsCalls.push("sign-upload");
      return {
        url: "https://storage.invalid/upload",
        token: null,
        key: input.key,
        headers: { "content-type": input.contentType },
      };
    },
    async createSignedDownload() {
      gcsCalls.push("sign-download");
      return "https://storage.invalid/download";
    },
    async readObjectHead() {
      gcsCalls.push("read");
      return body;
    },
    async putObject() {
      gcsCalls.push("put");
    },
    async deleteObjects() {
      gcsCalls.push("delete");
    },
  });
  assert.equal(
    resolveObjectStoragePort(undefined, { supabase: supabasePort, gcs: gcsPort }),
    supabasePort,
  );
  const gcsStorage = createObjectStorageFacade(
    resolveObjectStoragePort(" GCS ", { supabase: supabasePort, gcs: gcsPort }),
  );
  await gcsStorage.createSignedUpload({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    contentType: "image/png",
  });
  await gcsStorage.createSignedDownload({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    expiresInSeconds: 60,
  });
  await gcsStorage.readObjectHead({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    bytes: 3,
  });
  await gcsStorage.putObject({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    key: validKey,
    body,
    contentType: "image/png",
    upsert: false,
  });
  await gcsStorage.deleteObject({ bucket: PUBLIC_USER_MEDIA_BUCKET, key: validKey });
  assert.deepEqual(gcsCalls, ["sign-upload", "sign-download", "read", "put", "delete"]);
  assert.throws(
    () => resolveObjectStoragePort("gcs", { supabase: supabasePort }),
    /storage\.gcs_not_configured/,
  );
  assert.throws(
    () => resolveObjectStoragePort("unknown", { supabase: supabasePort, gcs: gcsPort }),
    /storage\.invalid_provider/,
  );

  const objectStorageSource = readFileSync(
    "src/lib/object-storage.ts",
    "utf8",
  );
  const adapterSource = readFileSync(
    "src/lib/supabase-object-storage.ts",
    "utf8",
  );
  const providerSource = readFileSync(
    "src/lib/supabase-storage.ts",
    "utf8",
  );
  const dogCardSource = readFileSync(
    "src/lib/dog-card-service.ts",
    "utf8",
  );
  for (const source of [objectStorageSource, adapterSource, providerSource]) {
    assert.match(source, /^import "server-only";/);
  }
  assert.doesNotMatch(objectStorageSource, /SUPABASE_SERVICE_ROLE_KEY|process\.env/);
  assert.doesNotMatch(objectStorageSource, /@supabase\/supabase-js/);
  assert.doesNotMatch(dogCardSource, /getSupabaseAdminClient|\.storage\.from\(/);
  assert.match(dogCardSource, /objectStorage\.putObject\(/);
  assert.match(dogCardSource, /upsert: false/);
  assert.match(
    dogCardSource,
    /storage\.upload_failed:[\s\S]*dog_card\.upload_failed/,
  );

  console.log("object storage port tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
