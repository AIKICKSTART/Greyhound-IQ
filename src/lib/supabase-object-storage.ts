import "server-only";

import type { ObjectStoragePort } from "@/lib/object-storage";
import {
  createSignedStorageDownloadUrl,
  createSignedStorageUploadUrl,
  downloadStorageObjectHead,
  downloadStorageObjectToFile,
  getStorageObjectInfo,
  listStorageObjectPaths,
  removeStorageObjects,
  streamStorageObject,
  uploadStorageObject,
  uploadStorageObjectFromFile,
} from "@/lib/supabase-storage";

type SupabaseStorageOperations = {
  createSignedUpload: typeof createSignedStorageUploadUrl;
  createSignedDownload: typeof createSignedStorageDownloadUrl;
  getObjectInfo: typeof getStorageObjectInfo;
  readObjectHead: typeof downloadStorageObjectHead;
  streamObject: typeof streamStorageObject;
  downloadObjectToFile: typeof downloadStorageObjectToFile;
  listObjectKeys: typeof listStorageObjectPaths;
  uploadObject: typeof uploadStorageObject;
  uploadObjectFromFile: typeof uploadStorageObjectFromFile;
  removeObjects: typeof removeStorageObjects;
};

const defaultOperations: SupabaseStorageOperations = {
  createSignedUpload: createSignedStorageUploadUrl,
  createSignedDownload: createSignedStorageDownloadUrl,
  getObjectInfo: getStorageObjectInfo,
  readObjectHead: downloadStorageObjectHead,
  streamObject: streamStorageObject,
  downloadObjectToFile: downloadStorageObjectToFile,
  listObjectKeys: listStorageObjectPaths,
  uploadObject: uploadStorageObject,
  uploadObjectFromFile: uploadStorageObjectFromFile,
  removeObjects: removeStorageObjects,
};

export function createSupabaseObjectStoragePort(
  overrides: Partial<SupabaseStorageOperations> = {},
): ObjectStoragePort {
  const operations = { ...defaultOperations, ...overrides };
  return {
    provider: "supabase",

    async createSignedUpload(input) {
      const result = await operations.createSignedUpload(
        input.bucket,
        input.key,
      );
      return {
        url: result.signedUrl,
        token: result.token,
        key: result.path,
        headers: {
          "cache-control": "max-age=31536000",
          "content-type": input.contentType,
          "x-upsert": "false",
        },
      };
    },

    async createSignedDownload(input) {
      return operations.createSignedDownload(
        input.bucket,
        input.key,
        input.expiresInSeconds,
      );
    },

    async getObjectInfo(input) {
      return operations.getObjectInfo(input.bucket, input.key);
    },

    async readObjectHead(input) {
      return operations.readObjectHead(
        input.bucket,
        input.key,
        input.bytes,
      );
    },

    async streamObject(input) {
      return operations.streamObject(
        input.bucket,
        input.key,
        input.range,
        input.signal,
      );
    },

    async downloadObjectToFile(input) {
      await operations.downloadObjectToFile(
        input.bucket,
        input.key,
        input.destinationPath,
      );
    },

    async listObjectKeys(input) {
      return operations.listObjectKeys(
        input.bucket,
        input.prefix,
        input.maxObjects,
      );
    },

    async putObject(input) {
      await operations.uploadObject(
        input.bucket,
        input.key,
        input.body,
        input.contentType,
        {
          cacheControl: input.cacheControl ?? null,
          upsert: input.upsert,
        },
      );
    },

    async putObjectFromFile(input) {
      await operations.uploadObjectFromFile(
        input.bucket,
        input.key,
        input.filePath,
        input.contentType,
        {
          cacheControl: input.cacheControl ?? null,
          upsert: input.upsert,
        },
      );
    },

    async deleteObjects(input) {
      await operations.removeObjects(input.bucket, [...input.keys]);
    },
  };
}

export const supabaseObjectStoragePort = createSupabaseObjectStoragePort();
