"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Paperclip, Subtitles, X } from "lucide-react";

const WEBVTT_MAX_BYTES = 256 * 1024;

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
  | "agent-outputs"
  | "custom-page";

type ActiveStep = "signing" | "uploading" | "finalizing";
type UploadStep = ActiveStep | "done" | "error";

interface UploadItem {
  key: string;
  filename: string;
  step: UploadStep;
  progress: number;
  mediaId?: string;
  scanStatus?: string;
  mimeType: string;
  previewUrl: string;
  altText: string;
  captionFilename?: string;
  captionState?: "uploading" | "removing" | "done" | "error";
  captionError?: string;
  error?: string;
  failedStep?: ActiveStep;
}

interface UploadContext {
  file: File;
  previewUrl: string;
  mediaId?: string;
  uploadUrl?: string;
  uploadUrlExpiresAtMs?: number;
  altText?: string;
}

interface MediaAttachmentFieldsProps {
  mediaContext?: MediaContext;
  maxFiles?: number;
  compact?: boolean;
  fieldName?: string;
  onPrimaryReadyPreviewChange?: (previewUrl: string | null) => void;
}

function uploadUrlNeedsRefresh(context: UploadContext) {
  return (
    !context.uploadUrl ||
    (context.uploadUrlExpiresAtMs ?? 0) <= Date.now()
  );
}

export function MediaAttachmentFields({
  mediaContext = "messages",
  maxFiles = 4,
  compact = false,
  fieldName = "mediaIds",
  onPrimaryReadyPreviewChange,
}: MediaAttachmentFieldsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ctxRef = useRef<Map<string, UploadContext>>(new Map());
  const xhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const nextKeyRef = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const remaining = maxFiles - items.length;
  const acceptedMediaTypes =
    mediaContext === "avatars" || mediaContext === "custom-page"
      ? ACCEPTED_MEDIA_TYPES.filter((type) => type.startsWith("image/"))
      : mediaContext === "listings"
        ? ACCEPTED_MEDIA_TYPES.filter(
            (type) => type.startsWith("image/") || type.startsWith("video/")
          )
      : mediaContext === "feed"
        ? ACCEPTED_MEDIA_TYPES.filter((type) => type !== "application/pdf")
        : ACCEPTED_MEDIA_TYPES;

  useEffect(() => {
    const contexts = ctxRef.current;
    return () => {
      for (const item of contexts.values()) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const primaryReadyPreview =
    items.find((item) => item.step === "done" && item.mediaId)?.previewUrl ??
    null;

  useEffect(() => {
    onPrimaryReadyPreviewChange?.(primaryReadyPreview);
  }, [onPrimaryReadyPreviewChange, primaryReadyPreview]);

  function patchItem(key: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  async function runUpload(key: string, from: ActiveStep) {
    const ctx = ctxRef.current.get(key);
    if (!ctx) return;

    let step: ActiveStep = from;
    if (step === "uploading" && uploadUrlNeedsRefresh(ctx)) {
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
      }>(`/api/media/${ctx.mediaId}/finalize`, {
        altText: ctx.altText?.trim() || undefined,
      });

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

    const accepted: { key: string; file: File; previewUrl: string }[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!acceptedMediaTypes.includes(file.type)) {
        rejected.push(file.name);
        continue;
      }
      const key = `upload-${nextKeyRef.current++}`;
      const previewUrl = URL.createObjectURL(file);
      ctxRef.current.set(key, { file, previewUrl });
      accepted.push({ key, file, previewUrl });
    }

    if (mediaContext === "feed") {
      const projectedTypes = [...ctxRef.current.values()].map(
        (context) => context.file.type
      );
      const imageCount = projectedTypes.filter((type) => type.startsWith("image/")).length;
      const audioVideoCount = projectedTypes.filter(
        (type) => type.startsWith("audio/") || type.startsWith("video/")
      ).length;
      if (audioVideoCount > 1 || (audioVideoCount === 1 && imageCount > 4)) {
        for (const item of accepted) {
          ctxRef.current.delete(item.key);
          URL.revokeObjectURL(item.previewUrl);
        }
        setFormError("A post can contain ten images, or one video/audio with up to four images.");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
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
        ...accepted.map(({ key, file, previewUrl }) => ({
          key,
          filename: file.name,
          mimeType: file.type,
          previewUrl,
          altText: "",
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
    const item = items.find((candidate) => candidate.key === key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    ctxRef.current.delete(key);
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function uploadCaption(key: string, file: File) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item?.mediaId || item.step !== "done") return;
    if (
      !file.name.toLowerCase().endsWith(".vtt") ||
      (file.type !== "" && file.type.toLowerCase() !== "text/vtt") ||
      file.size === 0 ||
      file.size > WEBVTT_MAX_BYTES
    ) {
      patchItem(key, {
        captionState: "error",
        captionError: "Choose a WebVTT (.vtt) file up to 256 KB.",
      });
      return;
    }

    patchItem(key, {
      captionState: "uploading",
      captionError: undefined,
    });
    try {
      const response = await fetch(`/api/media/${item.mediaId}/caption`, {
        method: "PUT",
        headers: { "Content-Type": "text/vtt" },
        body: file,
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      patchItem(key, {
        captionFilename: file.name,
        captionState: "done",
        captionError: undefined,
      });
    } catch (err) {
      patchItem(key, {
        captionState: "error",
        captionError: err instanceof Error ? err.message : "Caption upload failed.",
      });
    }
  }

  async function removeCaption(key: string) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item?.mediaId) return;
    patchItem(key, { captionState: "removing", captionError: undefined });
    try {
      const response = await fetch(`/api/media/${item.mediaId}/caption`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      patchItem(key, {
        captionFilename: undefined,
        captionState: undefined,
        captionError: undefined,
      });
    } catch (err) {
      patchItem(key, {
        captionState: "error",
        captionError: err instanceof Error ? err.message : "Caption removal failed.",
      });
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {items
        .filter((item) => item.step === "done" && item.mediaId)
        .map((item) => (
          <input
            key={item.key}
            type="hidden"
            name={fieldName}
            value={item.mediaId}
          />
        ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={remaining <= 0}
          onClick={() => inputRef.current?.click()}
          className="giq-outline-action min-h-11 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
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
          accept={acceptedMediaTypes.join(",")}
          onChange={(event) => addFiles(event.currentTarget.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.key}
              className={`overflow-hidden rounded-xl border bg-white/[0.02] ${
                item.step === "error"
                  ? "border-red-500/25"
                  : "border-white/[0.07]"
              }`}
            >
              <MediaPreview item={item} />
              <div className="space-y-2 p-3">
                <div role="status" className="flex min-h-8 items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <ImagePlus className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]" />
                  <span className="min-w-0 flex-1 truncate" title={itemLabel(item)}>
                    {itemLabel(item)}
                  </span>
                  {item.step === "error" && (
                    <button
                      type="button"
                      onClick={() => runUpload(item.key, item.failedStep ?? "signing")}
                      className="min-h-11 rounded px-2 text-[11px] font-semibold text-[hsl(var(--foreground))] underline-offset-2 hover:underline"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded text-[hsl(var(--subtle-foreground))] hover:text-red-200"
                    aria-label={
                      item.step === "done"
                        ? `Remove ${item.filename}`
                        : `Cancel upload of ${item.filename}`
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {(item.mimeType.startsWith("image/") ||
                  item.mimeType.startsWith("video/") ||
                  item.mimeType.startsWith("audio/")) && (
                  <label className="grid gap-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                    Description for accessibility
                    <input
                      value={item.altText}
                      maxLength={500}
                      onChange={(event) => {
                        const altText = event.target.value;
                        const context = ctxRef.current.get(item.key);
                        if (context) context.altText = altText;
                        patchItem(item.key, { altText });
                      }}
                      onBlur={() => {
                        if (!item.mediaId || item.step !== "done") return;
                        void patchMediaAltText(item.mediaId, item.altText);
                      }}
                      className="giq-form-control min-h-11 px-3 py-2 text-[12px]"
                      placeholder="Describe the media"
                    />
                  </label>
                )}
                {item.mimeType.startsWith("video/") && item.step === "done" && (
                  <div className="grid gap-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                    <label className="grid gap-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Subtitles className="h-3.5 w-3.5" aria-hidden="true" />
                        Caption track (WebVTT)
                      </span>
                      <input
                        type="file"
                        accept=".vtt,text/vtt"
                        disabled={
                          item.captionState === "uploading" ||
                          item.captionState === "removing"
                        }
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void uploadCaption(item.key, file);
                          event.currentTarget.value = "";
                        }}
                        className="giq-form-control min-h-11 px-3 py-2 text-[12px] file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-[11px] file:text-white"
                      />
                    </label>
                    <div aria-live="polite" className="flex min-h-6 items-center justify-between gap-2">
                      <span className={item.captionError ? "text-red-200" : undefined}>
                        {item.captionError ??
                          (item.captionState === "uploading"
                            ? "Uploading captions…"
                            : item.captionState === "removing"
                              ? "Removing captions…"
                              : item.captionFilename
                                ? `${item.captionFilename} attached`
                                : "Optional .vtt file, up to 256 KB")}
                      </span>
                      {item.captionFilename && (
                        <button
                          type="button"
                          disabled={
                            item.captionState === "uploading" ||
                            item.captionState === "removing"
                          }
                          onClick={() => void removeCaption(item.key)}
                          className="min-h-11 shrink-0 rounded px-2 font-semibold text-[hsl(var(--foreground))] underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Remove captions
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formError && <p className="text-[11px] text-red-200">{formError}</p>}
    </div>
  );
}

function MediaPreview({ item }: { item: UploadItem }) {
  if (item.mimeType.startsWith("image/")) {
    // Object URLs are local previews and cannot use the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.previewUrl} alt="" className="h-36 w-full object-cover" />;
  }
  if (item.mimeType.startsWith("video/")) {
    return (
      <video
        src={item.previewUrl}
        controls
        muted
        preload="metadata"
        className="h-36 w-full object-cover"
      />
    );
  }
  if (item.mimeType.startsWith("audio/")) {
    return <audio src={item.previewUrl} controls preload="metadata" className="w-full p-3" />;
  }
  return null;
}

async function patchMediaAltText(mediaId: string, altText: string) {
  await fetch(`/api/media/${mediaId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ altText: altText.trim() || null }),
  }).catch(() => null);
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
