import "server-only";

import type { ObjectStoragePort } from "@/lib/object-storage";
import { createGoogleCloudStoragePort } from "@/lib/gcs-object-storage";
import { supabaseObjectStoragePort } from "@/lib/supabase-object-storage";

export function resolveObjectStoragePort(
  provider: string | undefined,
  ports: { supabase: ObjectStoragePort; gcs?: ObjectStoragePort },
) {
  const selected = provider?.trim().toLowerCase() || "supabase";
  if (selected === "supabase") return ports.supabase;
  if (selected === "gcs") {
    if (ports.gcs) return ports.gcs;
    throw new Error("storage.gcs_not_configured");
  }
  throw new Error("storage.invalid_provider");
}

export const objectStoragePort = resolveObjectStoragePort(
  process.env.OBJECT_STORAGE_PROVIDER,
  {
    supabase: supabaseObjectStoragePort,
    gcs:
      process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase() === "gcs"
        ? createGoogleCloudStoragePort()
        : undefined,
  },
);
