import assert from "node:assert/strict";

import {
  createObjectStorageFacade,
  type ObjectStoragePort,
} from "./object-storage";
import { createSupabaseObjectStoragePort } from "./supabase-object-storage";
import { PRIVATE_USER_MEDIA_BUCKET } from "./storage-paths";

const key = "users/user_1/messages/message_1/media.bin";

function testPort(
  overrides: Partial<ObjectStoragePort> = {},
): ObjectStoragePort {
  return {
    async createSignedUpload(input) {
      return { url: "https://storage.invalid/upload", token: null, key: input.key };
    },
    async createSignedDownload() {
      return "https://storage.invalid/download";
    },
    async getObjectInfo() {
      return { size: 4 };
    },
    async readObjectHead() {
      return new Uint8Array([1, 2, 3, 4]);
    },
    async streamObject() {
      return emptyStream();
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
  const calls: Array<{ operation: string; input: unknown }> = [];
  const signal = new AbortController().signal;
  const storage = createObjectStorageFacade(testPort({
    async createSignedUpload(input) {
      calls.push({ operation: "sign-upload", input });
      return {
        url: "https://storage.invalid/upload",
        token: "upload-token",
        key: input.key,
      };
    },
    async createSignedDownload(input) {
      calls.push({ operation: "sign-download", input });
      return "https://storage.invalid/download";
    },
    async getObjectInfo(input) {
      calls.push({ operation: "info", input });
      return { size: 4 };
    },
    async readObjectHead(input) {
      calls.push({ operation: "head", input });
      return new Uint8Array([1, 2, 3, 4]);
    },
    async streamObject(input) {
      calls.push({ operation: "stream", input });
      return emptyStream();
    },
    async downloadObjectToFile(input) {
      calls.push({ operation: "download-file", input });
    },
    async listObjectKeys(input) {
      calls.push({ operation: "list", input });
      return [`${input.prefix}/one.bin`];
    },
    async putObjectFromFile(input) {
      calls.push({ operation: "put-file", input });
    },
  }));

  assert.deepEqual(
    await storage.createSignedUpload({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
    }),
    {
      url: "https://storage.invalid/upload",
      token: "upload-token",
      key,
    },
  );
  assert.equal(
    await storage.createSignedDownload({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      expiresInSeconds: 900,
    }),
    "https://storage.invalid/download",
  );
  assert.deepEqual(
    await storage.getObjectInfo({ bucket: PRIVATE_USER_MEDIA_BUCKET, key }),
    { size: 4 },
  );
  assert.deepEqual(
    await storage.readObjectHead({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      bytes: 4_100,
    }),
    new Uint8Array([1, 2, 3, 4]),
  );
  await storage.streamObject({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    range: { start: 10, end: 19 },
    signal,
  });
  await storage.downloadObjectToFile({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    destinationPath: "C:\\safe-temp\\media.bin",
  });
  assert.deepEqual(
    await storage.listObjectKeys({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      prefix: "users/user_1/messages",
      maxObjects: 501,
    }),
    ["users/user_1/messages/one.bin"],
  );
  await storage.putObjectFromFile({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    filePath: "C:\\safe-temp\\media.bin",
    contentType: "application/octet-stream",
    cacheControl: "31536000",
    upsert: true,
  });

  assert.equal(calls.length, 8);
  assert.deepEqual(calls[1], {
    operation: "sign-download",
    input: {
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      expiresInSeconds: 900,
    },
  });
  assert.deepEqual(calls[4], {
    operation: "stream",
    input: {
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      range: { start: 10, end: 19 },
      signal,
    },
  });

  const callsBeforeInvalidInput = calls.length;
  const invalidKey = "users/user_1/../user_2/private.bin";
  for (const operation of [
    () => storage.createSignedUpload({ bucket: PRIVATE_USER_MEDIA_BUCKET, key: invalidKey }),
    () => storage.createSignedDownload({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key: invalidKey,
      expiresInSeconds: 900,
    }),
    () => storage.getObjectInfo({ bucket: PRIVATE_USER_MEDIA_BUCKET, key: invalidKey }),
    () => storage.readObjectHead({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key: invalidKey,
      bytes: 4_100,
    }),
    () => storage.streamObject({ bucket: PRIVATE_USER_MEDIA_BUCKET, key: invalidKey }),
    () => storage.downloadObjectToFile({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key: invalidKey,
      destinationPath: "C:\\safe-temp\\media.bin",
    }),
    () => storage.listObjectKeys({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      prefix: invalidKey,
      maxObjects: 10,
    }),
  ]) {
    await assert.rejects(operation, /storage\.invalid_object_key/);
  }
  await assert.rejects(
    storage.createSignedDownload({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      expiresInSeconds: 0,
    }),
    /storage\.invalid_expiry/,
  );
  await assert.rejects(
    storage.streamObject({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      range: { start: 20, end: 10 },
    }),
    /storage\.invalid_range/,
  );
  await assert.rejects(
    storage.listObjectKeys({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      prefix: "users/user_1",
      maxObjects: 0,
    }),
    /storage\.invalid_list_limit/,
  );
  assert.equal(calls.length, callsBeforeInvalidInput);

  const providerFailure = new Error("storage.sign_download_failed:provider rejected");
  const failingStorage = createObjectStorageFacade(testPort({
    async createSignedDownload() {
      throw providerFailure;
    },
  }));
  await assert.rejects(
    failingStorage.createSignedDownload({
      bucket: PRIVATE_USER_MEDIA_BUCKET,
      key,
      expiresInSeconds: 900,
    }),
    (error) => error === providerFailure,
  );

  let signedUploadArgs: unknown[] | undefined;
  let signedDownloadArgs: unknown[] | undefined;
  let headArgs: unknown[] | undefined;
  let streamArgs: unknown[] | undefined;
  let downloadFileArgs: unknown[] | undefined;
  let listArgs: unknown[] | undefined;
  let uploadFileArgs: unknown[] | undefined;
  const adapter = createSupabaseObjectStoragePort({
    async createSignedUpload(...args) {
      signedUploadArgs = args;
      return { signedUrl: "https://storage.invalid/upload", token: "token", path: args[1] };
    },
    async createSignedDownload(...args) {
      signedDownloadArgs = args;
      return "https://storage.invalid/download";
    },
    async readObjectHead(...args) {
      headArgs = args;
      return Buffer.from([1, 2, 3, 4]);
    },
    async streamObject(...args) {
      streamArgs = args;
      return emptyStream();
    },
    async downloadObjectToFile(...args) {
      downloadFileArgs = args;
    },
    async listObjectKeys(...args) {
      listArgs = args;
      return [key];
    },
    async uploadObjectFromFile(...args) {
      uploadFileArgs = args;
      return { id: "id", path: args[1], fullPath: `${args[0]}/${args[1]}` };
    },
  });

  assert.deepEqual(
    await adapter.createSignedUpload({ bucket: PRIVATE_USER_MEDIA_BUCKET, key }),
    { url: "https://storage.invalid/upload", token: "token", key },
  );
  await adapter.createSignedDownload({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    expiresInSeconds: 900,
  });
  await adapter.readObjectHead({ bucket: PRIVATE_USER_MEDIA_BUCKET, key, bytes: 4_100 });
  await adapter.streamObject({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    range: { start: 10, end: 19 },
    signal,
  });
  await adapter.downloadObjectToFile({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    destinationPath: "C:\\safe-temp\\media.bin",
  });
  await adapter.listObjectKeys({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    prefix: "users/user_1",
    maxObjects: 501,
  });
  await adapter.putObjectFromFile({
    bucket: PRIVATE_USER_MEDIA_BUCKET,
    key,
    filePath: "C:\\safe-temp\\media.bin",
    contentType: "application/octet-stream",
    cacheControl: "31536000",
    upsert: true,
  });

  assert.deepEqual(signedUploadArgs, [PRIVATE_USER_MEDIA_BUCKET, key]);
  assert.deepEqual(signedDownloadArgs, [PRIVATE_USER_MEDIA_BUCKET, key, 900]);
  assert.deepEqual(headArgs, [PRIVATE_USER_MEDIA_BUCKET, key, 4_100]);
  assert.deepEqual(streamArgs, [
    PRIVATE_USER_MEDIA_BUCKET,
    key,
    { start: 10, end: 19 },
    signal,
  ]);
  assert.deepEqual(downloadFileArgs, [
    PRIVATE_USER_MEDIA_BUCKET,
    key,
    "C:\\safe-temp\\media.bin",
  ]);
  assert.deepEqual(listArgs, [PRIVATE_USER_MEDIA_BUCKET, "users/user_1", 501]);
  assert.deepEqual(uploadFileArgs, [
    PRIVATE_USER_MEDIA_BUCKET,
    key,
    "C:\\safe-temp\\media.bin",
    "application/octet-stream",
    { cacheControl: "31536000", upsert: true },
  ]);

  console.log("object storage read port tests passed");
}

function emptyStream() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
