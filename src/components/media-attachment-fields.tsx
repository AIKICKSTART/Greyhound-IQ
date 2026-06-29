"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Paperclip, X } from "lucide-react";

const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
];

type Bucket = "messages" | "listings" | "avatars" | "agent-outputs";

interface UploadedItem {
  id: string;
  filename: string;
  mimeType: string;
}

interface MediaAttachmentFieldsProps {
  bucket?: Bucket;
  maxFiles?: number;
  compact?: boolean;
}

export function MediaAttachmentFields({
  bucket = "messages",
  maxFiles = 4,
  compact = false,
}: MediaAttachmentFieldsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = maxFiles - items.length;

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || remaining <= 0) return;
    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
          throw new Error(`${file.name} is not a supported media type.`);
        }

        setStatus(`Uploading ${file.name}`);
        const signed = await postJson<{
          mediaId: string;
          uploadUrl: string;
        }>("/api/media/sign-upload", {
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          bucket,
        });

        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error(await errorMessage(uploadResponse));
        }

        const finalized = await postJson<{
          item: { id: string; originalName: string | null; mimeType: string };
        }>(`/api/media/${signed.mediaId}/finalize`, {});

        setItems((current) => [
          ...current,
          {
            id: finalized.item.id,
            filename: finalized.item.originalName ?? file.name,
            mimeType: finalized.item.mimeType,
          },
        ]);
      }
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatus(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    await fetch(`/api/media/${id}`, { method: "DELETE" }).catch(() => null);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => (
        <input key={item.id} type="hidden" name="mediaIds" value={item.id} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || remaining <= 0}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Attach media
        </button>
        <span className="text-[11px] text-[hsl(220_7%_42%)]">
          {items.length}/{maxFiles}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_MEDIA_TYPES.join(",")}
          onChange={(event) => uploadFiles(event.currentTarget.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-[hsl(215_14%_80%)]"
            >
              <ImagePlus className="h-3.5 w-3.5 shrink-0 text-[hsl(142_60%_48%)]" />
              <span className="truncate">{item.filename}</span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="rounded p-0.5 text-[hsl(220_7%_42%)] transition-colors hover:text-red-200"
                aria-label={`Remove ${item.filename}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {status && (
        <p className="text-[11px] text-[hsl(215_14%_65%)]">{status}</p>
      )}
      {error && <p className="text-[11px] text-red-200">{error}</p>}
    </div>
  );
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
