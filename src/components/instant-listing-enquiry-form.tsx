"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

export function InstantListingEnquiryForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") ?? "").trim();
    if (!message) return;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/enquiry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));

      const data = await response.json();
      const conversationId = data?.item?.conversationId;
      if (!conversationId) throw new Error("Could not open conversation");
      formRef.current?.reset();
      router.push(`/pulse/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not message seller in Pulse");
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-3">
      <label className="block">
        <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
          Pulse enquiry
        </span>
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          disabled={submitting}
          className="giq-form-control giq-textarea mt-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Ask the seller about this marketplace item."
        />
      </label>
      {error && (
        <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="giq-outline-action giq-submit-stack w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
            submitting ? "invisible" : ""
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message seller in Pulse
        </span>
        <span
          aria-hidden={!submitting}
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
            submitting ? "" : "invisible"
          }`}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sending...
        </span>
      </button>
    </form>
  );
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
