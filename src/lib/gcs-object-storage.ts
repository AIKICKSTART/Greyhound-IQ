import "server-only";

import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Storage } from "@google-cloud/storage";
import type { ObjectStoragePort } from "@/lib/object-storage";
import {
  resolveGcsBucketNames,
  validateGcsBucketNames,
  type GcsBucketNames,
} from "@/lib/gcs-object-storage-config";
import type { ObjectStorageBucket } from "@/lib/storage-paths";

export {
  GCS_BUCKET_ENV,
  resolveGcsBucketNames,
  type GcsBucketNames,
} from "@/lib/gcs-object-storage-config";

const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const CREATE_ONLY_UPLOAD_HEADERS = {
  "x-goog-if-generation-match": "0",
} as const;

type GoogleCloudStoragePortOptions = {
  storage?: Storage;
  bucketNames?: GcsBucketNames;
  now?: () => number;
};

export function createGoogleCloudStoragePort(
  options: GoogleCloudStoragePortOptions = {},
): ObjectStoragePort {
  const storage = options.storage ?? new Storage();
  const bucketNames = options.bucketNames
    ? validateGcsBucketNames(options.bucketNames)
    : resolveGcsBucketNames();
  const now = options.now ?? Date.now;

  function file(bucket: ObjectStorageBucket, key: string) {
    return storage.bucket(bucketNames[bucket]).file(key);
  }

  return {
    provider: "gcs",

    async createSignedUpload(input) {
      const physicalBucket = bucketNames[input.bucket];
      const [url] = await gcsCall("storage.sign_upload_failed", () =>
        file(input.bucket, input.key).getSignedUrl({
          action: "write",
          contentType: input.contentType,
          expires: now() + SIGNED_UPLOAD_TTL_MS,
          extensionHeaders: CREATE_ONLY_UPLOAD_HEADERS,
          version: "v4",
        }),
      );
      return {
        url: assertGcsSignedUrl(url, physicalBucket, input.key, [
          "content-type",
          "host",
          "x-goog-if-generation-match",
        ]),
        token: null,
        key: input.key,
        headers: {
          "content-type": input.contentType,
          ...CREATE_ONLY_UPLOAD_HEADERS,
        },
      };
    },

    async createSignedDownload(input) {
      const physicalBucket = bucketNames[input.bucket];
      const [url] = await gcsCall("storage.sign_download_failed", () =>
        file(input.bucket, input.key).getSignedUrl({
          action: "read",
          expires: now() + input.expiresInSeconds * 1000,
          version: "v4",
        }),
      );
      return assertGcsSignedUrl(url, physicalBucket, input.key);
    },

    async getObjectInfo(input) {
      const [metadata] = await gcsCall("storage.object_not_found", () =>
        file(input.bucket, input.key).getMetadata(),
      );
      return metadata;
    },

    async readObjectHead(input) {
      return gcsCall("media.storage_unavailable", async () =>
        collectBounded(
          file(input.bucket, input.key).createReadStream({
            end: input.bytes - 1,
            start: 0,
          }),
          input.bytes,
        ),
      );
    },

    async streamObject(input) {
      const stream = file(input.bucket, input.key).createReadStream(
        input.range ? { start: input.range.start, end: input.range.end } : undefined,
      );
      attachAbortSignal(stream, input.signal);
      return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    },

    async downloadObjectToFile(input) {
      await gcsCall("storage.download_failed", () =>
        pipeline(
          file(input.bucket, input.key).createReadStream(),
          createWriteStream(input.destinationPath, { flags: "w", mode: 0o600 }),
        ),
      );
    },

    async listObjectKeys(input) {
      const [files] = await gcsCall("storage.list_failed", () =>
        storage.bucket(bucketNames[input.bucket]).getFiles({
          maxResults: input.maxObjects ?? 5000,
          prefix: input.prefix,
        }),
      );
      return files
        .map((candidate) => candidate.name)
        .filter((name) => name.startsWith(input.prefix))
        .slice(0, input.maxObjects ?? 5000);
    },

    async putObject(input) {
      const body = input.body instanceof Blob
        ? Buffer.from(await input.body.arrayBuffer())
        : Buffer.from(input.body);
      await gcsCall("storage.upload_failed", () =>
        file(input.bucket, input.key).save(body, writeOptions(input)),
      );
    },

    async putObjectFromFile(input) {
      await gcsCall("storage.upload_failed", () =>
        storage.bucket(bucketNames[input.bucket]).upload(input.filePath, {
          destination: input.key,
          ...writeOptions(input),
        }),
      );
    },

    async deleteObjects(input) {
      await gcsCall("storage.delete_failed", () =>
        Promise.all(
          input.keys.map((key) =>
            file(input.bucket, key).delete({ ignoreNotFound: true }),
          ),
        ),
      );
    },
  };
}

export function assertGcsSignedUrl(
  value: string,
  physicalBucket: string,
  key: string,
  requiredSignedHeaders: readonly string[] = ["host"],
) {
  let url: URL;
  let decodedPath: string;
  try {
    url = new URL(value);
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("storage.gcs_signed_url_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "storage.googleapis.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    decodedPath !== `/${physicalBucket}/${key}` ||
    url.searchParams.get("X-Goog-Algorithm") !== "GOOG4-RSA-SHA256" ||
    !url.searchParams.get("X-Goog-Credential") ||
    !url.searchParams.get("X-Goog-Date") ||
    !url.searchParams.get("X-Goog-Expires") ||
    !url.searchParams.get("X-Goog-Signature") ||
    !signedHeadersInclude(
      url.searchParams.get("X-Goog-SignedHeaders"),
      requiredSignedHeaders,
    )
  ) {
    throw new Error("storage.gcs_signed_url_invalid");
  }
  return url.toString();
}

function signedHeadersInclude(
  value: string | null,
  requiredSignedHeaders: readonly string[],
) {
  if (!value) return false;
  const signedHeaders = new Set(value.split(";").map((header) => header.toLowerCase()));
  return requiredSignedHeaders.every((header) =>
    signedHeaders.has(header.toLowerCase())
  );
}

function writeOptions(input: {
  contentType: string;
  cacheControl?: string;
  upsert: boolean;
}) {
  return {
    metadata: {
      contentType: input.contentType,
      ...(input.cacheControl ? { cacheControl: input.cacheControl } : {}),
    },
    ...(input.upsert
      ? {}
      : { preconditionOpts: { ifGenerationMatch: 0 } }),
  };
}

async function collectBounded(stream: Readable, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      stream.destroy();
      throw new Error("storage.invalid_head_response");
    }
    chunks.push(buffer);
  }
  if (total === 0) throw new Error("storage.invalid_head_response");
  return Buffer.concat(chunks, total);
}

function attachAbortSignal(stream: Readable, signal?: AbortSignal) {
  if (!signal) return;
  const abort = () => stream.destroy(new Error("storage.download_aborted"));
  if (signal.aborted) {
    abort();
    return;
  }
  signal.addEventListener("abort", abort, { once: true });
  stream.once("close", () => signal.removeEventListener("abort", abort));
}

async function gcsCall<T>(code: string, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch {
    throw new Error(code);
  }
}
