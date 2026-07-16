import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, Home, LifeBuoy, RotateCcw } from "lucide-react";
import {
  AUTH_CALLBACK_RECOVERY_COPY,
  parseAuthCallbackFailureReason,
  parseAuthCallbackReference,
} from "@/lib/auth-callback-recovery";

export const metadata: Metadata = {
  title: "Sign-in recovery — GreyhoundIQ",
  description: "Recover safely from an interrupted GreyhoundIQ sign-in.",
  robots: { index: false, follow: false },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string | string[];
    ref?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const reason = parseAuthCallbackFailureReason(params.reason);
  const reference = parseAuthCallbackReference(params.ref);
  const copy = AUTH_CALLBACK_RECOVERY_COPY[reason];

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <section
        aria-labelledby="auth-error-title"
        className="w-full max-w-lg text-center"
        data-trace-id="AUTH.CALLBACK.RECOVER"
      >
        <CircleAlert
          aria-hidden="true"
          className="mx-auto mb-5 h-11 w-11 text-[hsl(var(--secondary))]"
        />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--secondary))]">
          Secure sign-in recovery
        </p>
        <h1
          id="auth-error-title"
          className="mb-3 text-4xl font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]"
        >
          {copy.title}
        </h1>
        <p className="mx-auto mb-8 max-w-md text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {copy.description}
        </p>
        {reference ? (
          <p className="mx-auto mb-5 max-w-md text-[11px] text-[hsl(var(--subtle-foreground))]">
            Support reference: <code>{reference}</code>
          </p>
        ) : null}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in?returnTo=%2Ffeed"
            className="giq-liquid-purple-button min-h-11 px-5 text-[13px] font-semibold"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Try sign-in again
          </Link>
          <Link
            href="/contact"
            className="giq-button giq-button-glass min-h-11 px-5 text-[13px] font-medium"
          >
            <LifeBuoy aria-hidden="true" className="h-4 w-4" />
            Contact support
          </Link>
          <Link
            href="/"
            className="giq-button giq-button-glass min-h-11 px-5 text-[13px] font-medium"
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
