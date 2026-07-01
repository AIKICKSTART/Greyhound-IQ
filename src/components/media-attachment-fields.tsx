"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Paperclip, X } from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  | "forum"
  | "messages"
  | "verification"
  | "agent-outputs";

interface UploadedItem {
  id: string;
  filename: string;
  mimeType: string;
}

interface MediaAttachmentFieldsProps {
  mediaContext?: MediaContext;
  maxFiles?: number;
  compact?: boolean;
}

let browserSupabase: SupabaseClient | null = null;

export function MediaAttachmentFields({
  mediaContext = "messages",
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
          bucket: string;
          objectPath: string;
          uploadToken: string;
        }>("/api/media/sign-upload", {
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          mediaContext,
        });

        const { error: uploadError } = await getBrowserSupabase()
          .storage.from(signed.bucket)
          .uploadToSignedUrl(signed.objectPath, signed.uploadToken, file, {
            contentType: file.type,
            cacheControl: "31536000",
          });
        if (uploadError) {
          throw new Error(uploadError.message);
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
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
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
              <ImagePlus className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]" />
              <span className="truncate">{item.filename}</span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="rounded p-0.5 text-[hsl(var(--subtle-foreground))] transition-colors hover:text-red-200"
                aria-label={`Remove ${item.filename}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {status && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{status}</p>
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

function getBrowserSupabase() {
  if (browserSupabase) return browserSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase Storage is not configured for browser uploads.");
  }

  browserSupabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return browserSupabase;
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
