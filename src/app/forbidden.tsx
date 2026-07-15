import Link from "next/link";
import { Home, ShieldAlert, UserRound } from "lucide-react";

export default function Forbidden() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <section className="w-full max-w-lg text-center" aria-labelledby="forbidden-title">
        <div className="giq-badge giq-badge-gold mb-6">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px] font-medium tracking-[0.04em] text-[hsl(var(--secondary))]">
            403 · Permission required
          </span>
        </div>
        <h1
          id="forbidden-title"
          className="mb-3 text-5xl font-semibold leading-none tracking-[-0.04em] text-[hsl(var(--foreground))]"
        >
          Access denied.
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed tracking-[-0.011em] text-[hsl(var(--muted-foreground))]">
          You are signed in, but this account does not have permission to open
          this area. Return to your account or continue to the public site.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/account"
            className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Open account
          </Link>
          <Link
            href="/"
            className="giq-button giq-button-glass px-5 text-[13px] font-medium"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
