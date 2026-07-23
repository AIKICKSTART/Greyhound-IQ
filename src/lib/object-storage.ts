import "server-only";

import { objectStoragePort } from "@/lib/object-storage-provider";
import {
  isObjectStorageBucket,
  type ObjectStorageBucket,
} from "@/lib/storage-paths";

const MAX_OBJECT_KEY_BYTES = 1024;

export type PutObjectInput = {
  bucket: ObjectStorageBucket;
  key: string;
  body: Uint8Array | Blob;
  contentType: string;
  cacheControl?: string;
  upsert: boolean;
};

export type DeleteObjectsInput = {
  bucket: ObjectStorageBucket;
  keys: readonly string[];
};

export type ObjectStorageRange = {
  start: number;
  end: number;
};

export type SignedUploadGrant = {
  url: string;
  token: string | null;
  key: string;
  headers: Readonly<Record<string, string>>;
};

export type ObjectStoragePort = {
  provider: "gcs" | "supabase";
  createSignedUpload(input: {
    bucket: ObjectStorageBucket;
    key: string;
    contentType: string;
  }): Promise<SignedUploadGrant>;
  createSignedDownload(input: {
    bucket: ObjectStorageBucket;
    key: string;
    expiresInSeconds: number;
  }): Promise<string>;
  getObjectInfo(input: {
    bucket: ObjectStorageBucket;
    key: string;
  }): Promise<unknown>;
  readObjectHead(input: {
    bucket: ObjectStorageBucket;
    key: string;
    bytes: number;
  }): Promise<Uint8Array>;
  streamObject(input: {
    bucket: ObjectStorageBucket;
    key: string;
    range?: ObjectStorageRange;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>>;
  downloadObjectToFile(input: {
    bucket: ObjectStorageBucket;
    key: string;
    destinationPath: string;
  }): Promise<void>;
  listObjectKeys(input: {
    bucket: ObjectStorageBucket;
    prefix: string;
    maxObjects?: number;
  }): Promise<string[]>;
  putObject(input: PutObjectInput): Promise<void>;
  putObjectFromFile(input: {
    bucket: ObjectStorageBucket;
    key: string;
    filePath: string;
    contentType: string;
    cacheControl?: string;
    upsert: boolean;
  }): Promise<void>;
  deleteObjects(input: DeleteObjectsInput): Promise<void>;
};

export function createObjectStorageFacade(port: ObjectStoragePort) {
  return {
    provider: port.provider,

    async createSignedUpload(input: {
      bucket: ObjectStorageBucket;
      key: string;
      contentType: string;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      return port.createSignedUpload({
        bucket,
        key,
        contentType: assertContentType(input.contentType),
      });
    },

    async createSignedDownload(input: {
      bucket: ObjectStorageBucket;
      key: string;
      expiresInSeconds: number;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      if (
        !Number.isSafeInteger(input.expiresInSeconds) ||
        input.expiresInSeconds <= 0
      ) {
        throw new Error("storage.invalid_expiry");
      }
      return port.createSignedDownload({
        bucket,
        key,
        expiresInSeconds: input.expiresInSeconds,
      });
    },

    async getObjectInfo(input: {
      bucket: ObjectStorageBucket;
      key: string;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      return port.getObjectInfo({ bucket, key });
    },

    async readObjectHead(input: {
      bucket: ObjectStorageBucket;
      key: string;
      bytes: number;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0) {
        throw new Error("storage.invalid_head_size");
      }
      return port.readObjectHead({ bucket, key, bytes: input.bytes });
    },

    async streamObject(input: {
      bucket: ObjectStorageBucket;
      key: string;
      range?: ObjectStorageRange;
      signal?: AbortSignal;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      const range = input.range
        ? assertObjectStorageRange(input.range)
        : undefined;
      return port.streamObject({
        bucket,
        key,
        range,
        signal: input.signal,
      });
    },

    async downloadObjectToFile(input: {
      bucket: ObjectStorageBucket;
      key: string;
      destinationPath: string;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      await port.downloadObjectToFile({
        bucket,
        key,
        destinationPath: input.destinationPath,
      });
    },

    async listObjectKeys(input: {
      bucket: ObjectStorageBucket;
      prefix: string;
      maxObjects?: number;
    }) {
      const bucket = assertObjectStorageBucket(input.bucket);
      const prefix = assertObjectStorageKey(input.prefix);
      if (
        input.maxObjects !== undefined &&
        (!Number.isSafeInteger(input.maxObjects) || input.maxObjects <= 0)
      ) {
        throw new Error("storage.invalid_list_limit");
      }
      return port.listObjectKeys({
        bucket,
        prefix,
        maxObjects: input.maxObjects,
      });
    },

    async putObject(input: PutObjectInput) {
      const { bucket, key } = assertObjectStorageLocation(input);
      await port.putObject({ ...input, bucket, key });
    },

    async putObjectFromFile(input: {
      bucket: ObjectStorageBucket;
      key: string;
      filePath: string;
      contentType: string;
      cacheControl?: string;
      upsert: boolean;
    }) {
      const { bucket, key } = assertObjectStorageLocation(input);
      await port.putObjectFromFile({ ...input, bucket, key });
    },

    async deleteObject(input: {
      bucket: ObjectStorageBucket;
      key: string;
    }) {
      const bucket = assertObjectStorageBucket(input.bucket);
      const key = assertObjectStorageKey(input.key);
      await port.deleteObjects({ bucket, keys: [key] });
    },

    async deleteObjects(input: DeleteObjectsInput) {
      const bucket = assertObjectStorageBucket(input.bucket);
      if (input.keys.length === 0) return;
      const keys = input.keys.map(assertObjectStorageKey);
      await port.deleteObjects({ bucket, keys });
    },
  };
}

export type ObjectStorage = ReturnType<typeof createObjectStorageFacade>;

export const objectStorage = createObjectStorageFacade(
  objectStoragePort,
);

export function assertObjectStorageKey(key: string) {
  const segments = key.split("/");
  if (
    key.length === 0 ||
    new TextEncoder().encode(key).byteLength > MAX_OBJECT_KEY_BYTES ||
    key.startsWith("/") ||
    key.endsWith("/") ||
    key.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(key) ||
    segments.some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw new Error("storage.invalid_object_key");
  }
  return key;
}

function assertObjectStorageLocation(input: {
  bucket: string;
  key: string;
}) {
  return {
    bucket: assertObjectStorageBucket(input.bucket),
    key: assertObjectStorageKey(input.key),
  };
}

function assertObjectStorageRange(range: ObjectStorageRange) {
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    range.start < 0 ||
    range.end < range.start
  ) {
    throw new Error("storage.invalid_range");
  }
  return { start: range.start, end: range.end };
}

function assertContentType(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 255 ||
    !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
  ) {
    throw new Error("storage.invalid_content_type");
  }
  return normalized;
}

function assertObjectStorageBucket(bucket: string): ObjectStorageBucket {
  if (!isObjectStorageBucket(bucket)) {
    throw new Error("storage.invalid_bucket");
  }
  return bucket;
}
