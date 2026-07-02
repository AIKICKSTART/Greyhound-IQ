import Link from "next/link";
import { Home, Search } from "lucide-react";

export const metadata = { title: "Page Not Found — GreyhoundIQ" };

export default function NotFound() {
  return (
    <div className="fade-in min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="giq-badge giq-badge-gold mb-6">
          <span className="text-[11px] text-[hsl(var(--secondary))] font-medium tracking-[0.04em]">
            404
          </span>
        </div>
        <h1
          className="text-5xl font-semibold text-[hsl(var(--foreground))] mb-3 tracking-[-0.04em] leading-[1.0]"
        >
          Off-track.
        </h1>
        <p
          className="text-[15px] text-[hsl(var(--muted-foreground))] mb-8 leading-relaxed tracking-[-0.011em]"
        >
          The page you&apos;re looking for has either been moved, or never existed.
          Try one of these instead.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
          >
            <Home className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/dogs"
            className="giq-button giq-button-glass px-5 text-[13px] font-medium"
          >
            <Search className="h-4 w-4" />
            Search dogs
          </Link>
        </div>
      </div>
    </div>
  );
}
