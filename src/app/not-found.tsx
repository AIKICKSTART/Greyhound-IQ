import Link from "next/link";
import { Home, Search } from "lucide-react";

export const metadata = { title: "Page Not Found — GreyhoundIQ" };

export default function NotFound() {
  return (
    <div className="fade-in min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 mb-6">
          <span className="text-[11px] text-[hsl(25_95%_53%)] font-medium tracking-[0.04em]">
            404
          </span>
        </div>
        <h1
          className="text-5xl font-semibold text-[hsl(210_13%_97%)] mb-3 tracking-[-0.04em] leading-[1.0]"
        >
          Off-track.
        </h1>
        <p
          className="text-[15px] text-[hsl(215_14%_65%)] mb-8 leading-relaxed tracking-[-0.011em]"
        >
          The page you&apos;re looking for has either been moved, or never existed.
          Try one of these instead.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.25)] hover:brightness-110 transition-all tracking-[-0.013em]"
          >
            <Home className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/dogs"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-[hsl(210_13%_97%)] hover:bg-white/[0.06] backdrop-blur-sm transition-all"
          >
            <Search className="h-4 w-4" />
            Search dogs
          </Link>
        </div>
      </div>
    </div>
  );
}
