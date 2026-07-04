"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";

export function InstantMessageComposer({
  conversationId,
  disabled,
}: {
  conversationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const mediaIds = formData
      .getAll("mediaIds")
      .map(String)
      .filter(Boolean);
    if (!body) return;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, mediaIds }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));

      formRef.current?.reset();
      setResetKey((current) => current + 1);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="border-t border-white/[0.06] p-5">
      <label className="block">
        <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Reply
        </span>
        <textarea
          name="body"
          required
          disabled={disabled || busy}
          maxLength={5000}
          rows={5}
          className="giq-form-control giq-textarea mt-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={
            disabled
              ? "Unblock this conversation before replying."
              : "Type a private reply."
          }
        />
      </label>
      <div className="mt-3">
        <MediaAttachmentFields key={resetKey} compact />
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </p>
      )}
      <div className="mt-4">
        <button
          type="submit"
          disabled={disabled || busy}
          className="giq-button giq-button-primary giq-submit-stack px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
              busy ? "invisible" : ""
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            Send reply
          </span>
          <span
            aria-hidden={!busy}
            className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
              busy ? "" : "invisible"
            }`}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending...
          </span>
        </button>
      </div>
    </form>
  );
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
