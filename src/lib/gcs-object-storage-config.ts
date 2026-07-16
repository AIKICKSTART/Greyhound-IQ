import {
  OBJECT_STORAGE_BUCKETS,
  type ObjectStorageBucket,
} from "@/lib/storage-paths";

export const GCS_BUCKET_ENV = {
  "site-assets": "GCS_SITE_ASSETS_BUCKET",
  "public-user-media": "GCS_PUBLIC_USER_MEDIA_BUCKET",
  "private-user-media": "GCS_PRIVATE_USER_MEDIA_BUCKET",
} as const satisfies Record<ObjectStorageBucket, string>;

export type GcsBucketNames = Readonly<Record<ObjectStorageBucket, string>>;

export function resolveGcsBucketNames(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GcsBucketNames {
  const entries = OBJECT_STORAGE_BUCKETS.map((logicalBucket) => {
    const envName = GCS_BUCKET_ENV[logicalBucket];
    const physicalBucket = env[envName]?.trim();
    if (!physicalBucket) {
      throw new Error(`storage.gcs_bucket_not_configured:${envName}`);
    }
    assertGcsBucketName(physicalBucket);
    return [logicalBucket, physicalBucket] as const;
  });
  const physicalBuckets = entries.map(([, bucket]) => bucket);
  if (new Set(physicalBuckets).size !== physicalBuckets.length) {
    throw new Error("storage.gcs_bucket_mapping_conflict");
  }
  return Object.fromEntries(entries) as GcsBucketNames;
}

export function validateGcsBucketNames(bucketNames: GcsBucketNames) {
  for (const logicalBucket of OBJECT_STORAGE_BUCKETS) {
    assertGcsBucketName(bucketNames[logicalBucket]);
  }
  if (new Set(Object.values(bucketNames)).size !== OBJECT_STORAGE_BUCKETS.length) {
    throw new Error("storage.gcs_bucket_mapping_conflict");
  }
  return bucketNames;
}

function assertGcsBucketName(value: string) {
  const labels = value.split(".");
  if (
    value.length < 3 ||
    value.length > 222 ||
    !/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(value) ||
    labels.some((label) => label.length === 0 || label.length > 63) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)
  ) {
    throw new Error("storage.gcs_bucket_name_invalid");
  }
  return value;
}
