import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseStorageBucket } from "@/lib/storage-paths";

let adminClient: SupabaseClient | null = null;
const STORAGE_PROCESSING_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("storage.supabase_not_configured");
  }
  if (looksLikePlaceholder(url) || looksLikePlaceholder(serviceRoleKey)) {
    throw new Error("storage.supabase_not_configured");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

export async function createSignedStorageUploadUrl(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (error) throw new Error(`storage.sign_upload_failed:${error.message}`);
  return data;
}

export async function createSignedStorageDownloadUrl(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  expiresInSeconds: number
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error) throw new Error(`storage.sign_download_failed:${error.message}`);
  return data.signedUrl;
}

export async function getStorageObjectInfo(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .info(objectPath);

  if (error) throw new Error(`storage.object_not_found:${error.message}`);
  return data;
}

export async function downloadStorageObject(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .download(objectPath);

  if (error) throw new Error(`storage.download_failed:${error.message}`);
  return data;
}

export async function streamStorageObject(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  range?: { start: number; end: number },
  signal?: AbortSignal
) {
  const signedUrl = await createSignedStorageDownloadUrl(bucket, objectPath, 600);
  const response = await fetch(signedUrl, {
    headers: range ? { Range: `bytes=${range.start}-${range.end}` } : undefined,
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`storage.download_failed:http_${response.status}`);
  }
  if (!range || response.status === 206) return response.body;
  if (response.status !== 200) {
    throw new Error(`storage.download_failed:http_${response.status}`);
  }
  return sliceStorageStream(
    response.body,
    range.start,
    range.end - range.start + 1
  );
}

export async function downloadStorageObjectToFile(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  destinationPath: string
) {
  const stream = await streamStorageObject(
    bucket,
    objectPath,
    undefined,
    AbortSignal.timeout(STORAGE_PROCESSING_DOWNLOAD_TIMEOUT_MS)
  );
  const reader = stream.getReader();
  const file = await open(destinationPath, "w", 0o600);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(
          value,
          offset,
          value.byteLength - offset
        );
        if (bytesWritten <= 0) throw new Error("storage.file_write_failed");
        offset += bytesWritten;
      }
    }
  } finally {
    reader.releaseLock();
    await file.close();
  }
}

/**
 * Downloads only the leading bytes of an object via an HTTP Range request, so
 * signature sniffing on a large video doesn't pull the whole file. Falls back
 * to a full download if the storage backend ignores the Range header.
 */
export async function downloadStorageObjectHead(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  bytes: number
) {
  const stream = await streamStorageObject(bucket, objectPath, {
    start: 0,
    end: Math.max(0, bytes - 1),
  });
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < bytes) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, bytes - total);
      chunks.push(chunk);
      total += chunk.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function removeStorageObject(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  return removeStorageObjects(bucket, [objectPath]);
}

export async function removeStorageObjects(
  bucket: SupabaseStorageBucket,
  objectPaths: string[]
) {
  if (objectPaths.length === 0) return;
  const { error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .remove(objectPaths);

  if (error) throw new Error(`storage.delete_failed:${error.message}`);
}

export async function listStorageObjectPaths(
  bucket: SupabaseStorageBucket,
  prefix: string,
  maxObjects = 5000
) {
  const paths: string[] = [];
  const pendingPrefixes = [prefix.replace(/\/+$/, "")];
  while (pendingPrefixes.length > 0 && paths.length < maxObjects) {
    const currentPrefix = pendingPrefixes.shift()!;
    let offset = 0;
    while (paths.length < maxObjects) {
      const { data, error } = await getSupabaseAdminClient()
        .storage.from(bucket)
        .list(currentPrefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`storage.list_failed:${error.message}`);
      for (const entry of data) {
        const entryPath = `${currentPrefix}/${entry.name}`;
        if (entry.id) paths.push(entryPath);
        else pendingPrefixes.push(entryPath);
        if (paths.length >= maxObjects) break;
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return paths;
}

export async function uploadStorageObject(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  body: Uint8Array | Blob,
  contentType: string
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .upload(objectPath, body, {
      cacheControl: "31536000",
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`storage.upload_failed:${error.message}`);
  return data;
}

export async function uploadStorageObjectFromFile(
  bucket: SupabaseStorageBucket,
  objectPath: string,
  filePath: string,
  contentType: string
) {
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .upload(objectPath, createReadStream(filePath), {
      cacheControl: "31536000",
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`storage.upload_failed:${error.message}`);
  return data;
}

function sliceStorageStream(
  source: ReadableStream<Uint8Array>,
  bytesToSkip: number,
  bytesToEmit: number
) {
  const reader = source.getReader();
  let consumed = 0;
  let emitted = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (emitted < bytesToEmit) {
        const { value, done } = await reader.read();
        if (done) {
          controller.error(new Error("storage.range_incomplete"));
          return;
        }
        const chunkStart = Math.max(0, bytesToSkip - consumed);
        const available = Math.max(0, value.byteLength - chunkStart);
        const take = Math.min(available, bytesToEmit - emitted);
        consumed += value.byteLength;
        if (take === 0) continue;
        controller.enqueue(value.subarray(chunkStart, chunkStart + take));
        emitted += take;
        if (emitted === bytesToEmit) {
          controller.close();
          await reader.cancel().catch(() => undefined);
        }
        return;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-");
}
