"use client";

import { useRef, useState } from "react";
import { ImagePlus, Paperclip, X } from "lucide-react";

const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
];

type MediaContext =
  | "avatars"
  | "dogs"
  | "listings"
  | "feed"
  | "forum"
  | "messages"
  | "verification"
  | "agent-outputs";

type ActiveStep = "signing" | "uploading" | "finalizing";
type UploadStep = ActiveStep | "done" | "error";

interface UploadItem {
  key: string;
  filename: string;
  step: UploadStep;
  progress: number;
  mediaId?: string;
  scanStatus?: string;
  error?: string;
  failedStep?: ActiveStep;
}

interface UploadContext {
  file: File;
  mediaId?: string;
  uploadUrl?: string;
  uploadUrlExpiresAtMs?: number;
}

interface MediaAttachmentFieldsProps {
  mediaContext?: MediaContext;
  maxFiles?: number;
  compact?: boolean;
}

export function MediaAttachmentFields({
  mediaContext = "messages",
  maxFiles = 4,
  compact = false,
}: MediaAttachmentFieldsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ctxRef = useRef<Map<string, UploadContext>>(new Map());
  const xhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const nextKeyRef = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const remaining = maxFiles - items.length;

  function patchItem(key: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  async function runUpload(key: string, from: ActiveStep) {
    const ctx = ctxRef.current.get(key);
    if (!ctx) return;

    let step: ActiveStep = from;
    if (
      step === "uploading" &&
      (!ctx.uploadUrl || (ctx.uploadUrlExpiresAtMs ?? 0) <= Date.now())
    ) {
      // Signed URL missing or expired: restart from a fresh signature.
      step = "signing";
    }

    try {
      if (step === "signing") {
        if (ctx.mediaId) {
          // Clean up the asset row from the previous failed attempt.
          void fetch(`/api/media/${ctx.mediaId}`, { method: "DELETE" }).catch(
            () => null
          );
          ctx.mediaId = undefined;
        }
        patchItem(key, { step: "signing", progress: 0, error: undefined });
        const signed = await postJson<{
          mediaId: string;
          uploadUrl: string;
          expiresAt: string;
        }>("/api/media/sign-upload", {
          filename: ctx.file.name,
          mimeType: ctx.file.type,
          sizeBytes: ctx.file.size,
          mediaContext,
        });
        ctx.mediaId = signed.mediaId;
        ctx.uploadUrl = signed.uploadUrl;
        ctx.uploadUrlExpiresAtMs = Date.parse(signed.expiresAt);
        step = "uploading";
      }

      if (step === "uploading") {
        patchItem(key, { step: "uploading", progress: 0, error: undefined });
        await putFile(xhrsRef.current, key, ctx.uploadUrl!, ctx.file, (pct) =>
          patchItem(key, { progress: pct })
        );
        step = "finalizing";
      }

      patchItem(key, { step: "finalizing", error: undefined });
      const finalized = await postJson<{
        item: {
          id: string;
          originalName: string | null;
          mimeType: string;
          scanStatus?: string;
        };
      }>(`/api/media/${ctx.mediaId}/finalize`, {});

      patchItem(key, {
        step: "done",
        progress: 100,
        mediaId: finalized.item.id,
        filename: finalized.item.originalName ?? ctx.file.name,
        scanStatus: finalized.item.scanStatus,
      });
    } catch (err) {
      // If the item was cancelled/removed, patchItem is a no-op.
      patchItem(key, {
        step: "error",
        failedStep: step,
        error: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0 || remaining <= 0) return;
    setFormError(null);

    const accepted: { key: string; file: File }[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        rejected.push(file.name);
        continue;
      }
      const key = `upload-${nextKeyRef.current++}`;
      ctxRef.current.set(key, { file });
      accepted.push({ key, file });
    }

    if (rejected.length > 0) {
      setFormError(
        `${rejected.join(", ")} ${
          rejected.length === 1 ? "is not a supported media type." : "are not supported media types."
        }`
      );
    }
    if (accepted.length > 0) {
      setItems((current) => [
        ...current,
        ...accepted.map(({ key, file }) => ({
          key,
          filename: file.name,
          step: "signing" as const,
          progress: 0,
        })),
      ]);
      for (const { key } of accepted) void runUpload(key, "signing");
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeItem(key: string) {
    const ctx = ctxRef.current.get(key);
    xhrsRef.current.get(key)?.abort();
    const mediaId =
      ctx?.mediaId ?? items.find((item) => item.key === key)?.mediaId;
    if (mediaId) {
      void fetch(`/api/media/${mediaId}`, { method: "DELETE" }).catch(
        () => null
      );
    }
    ctxRef.current.delete(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {items
        .filter((item) => item.step === "done" && item.mediaId)
        .map((item) => (
          <input
            key={item.key}
            type="hidden"
            name="mediaIds"
            value={item.mediaId}
          />
        ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={remaining <= 0}
          onClick={() => inputRef.current?.click()}
          className="giq-outline-action min-h-9 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach media
        </button>
        <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
          {items.length}/{maxFiles}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_MEDIA_TYPES.join(",")}
          onChange={(event) => addFiles(event.currentTarget.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.key}
              role="status"
              className={`giq-status-pill max-w-full ${
                item.step === "error"
                  ? "border-red-500/25 bg-red-500/10 text-red-200"
                  : ""
              }`}
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]" />
              <span className="truncate" title={itemLabel(item)}>
                {itemLabel(item)}
              </span>
              {item.step === "error" && (
                <button
                  type="button"
                  onClick={() => runUpload(item.key, item.failedStep ?? "signing")}
                  className="rounded px-1 text-[11px] font-semibold text-[hsl(var(--foreground))] underline-offset-2 transition-colors hover:underline focus-visible:underline"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="rounded p-0.5 text-[hsl(var(--subtle-foreground))] transition-colors hover:text-red-200"
                aria-label={
                  item.step === "done"
                    ? `Remove ${item.filename}`
                    : `Cancel upload of ${item.filename}`
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {formError && <p className="text-[11px] text-red-200">{formError}</p>}
    </div>
  );
}

function itemLabel(item: UploadItem) {
  switch (item.step) {
    case "signing":
      return `${item.filename} — Preparing`;
    case "uploading":
      return `${item.filename} — Uploading ${item.progress}%`;
    case "finalizing":
      return `${item.filename} — Finishing`;
    case "error":
      return `${item.filename} — ${item.error ?? "Upload failed."}`;
    default:
      return `${item.filename}${item.scanStatus === "pending" ? " (scanning)" : ""}`;
  }
}

// Raw PUT to the Supabase signed upload URL, mirroring the headers
// @supabase/storage-js sends for a signed-url PUT so we get progress events.
function putFile(
  xhrs: Map<string, XMLHttpRequest>,
  key: string,
  url: string,
  file: File,
  onProgress: (pct: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrs.set(key, xhr);
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      xhrs.delete(key);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(storagePutError(xhr)));
    };
    xhr.onerror = () => {
      xhrs.delete(key);
      reject(new Error("Network error during upload."));
    };
    xhr.onabort = () => {
      xhrs.delete(key);
      reject(new Error("Upload cancelled."));
    };
    xhr.send(file);
  });
}

function storagePutError(xhr: XMLHttpRequest) {
  try {
    const data = JSON.parse(xhr.responseText) as {
      message?: string;
      error?: string;
    };
    return data.message ?? data.error ?? `Upload failed with ${xhr.status}`;
  } catch {
    return `Upload failed with ${xhr.status}`;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
