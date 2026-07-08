import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseStorageBucket } from "@/lib/storage-paths";

let adminClient: SupabaseClient | null = null;

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
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    // Third arg is passed through as fetch options; a Range header yields a
    // 206 partial response when supported.
    .download(objectPath, undefined, {
      headers: { Range: `bytes=0-${Math.max(0, bytes - 1)}` },
    } as never);

  if (error) throw new Error(`storage.download_failed:${error.message}`);
  const buffer = Buffer.from(await data.slice(0, bytes).arrayBuffer());
  return buffer;
}

export async function removeStorageObject(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  const { error } = await getSupabaseAdminClient()
    .storage.from(bucket)
    .remove([objectPath]);

  if (error) throw new Error(`storage.delete_failed:${error.message}`);
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("your_") || normalized.includes("your-");
}
