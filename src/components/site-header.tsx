import Link from "next/link";
import { Search, Menu } from "lucide-react";
import Image from "next/image";
import { signOut } from "@workos-inc/authkit-nextjs";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCurrentUser } from "@/lib/auth";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "215 14% 65%" },
  pro: { label: "Pro", color: "142 60% 48%" },
  pro_plus: { label: "Pro+", color: "25 95% 53%" },
};

const NAV_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/results", label: "Results" },
  { href: "/dogs", label: "Dogs" },
  { href: "/tracks", label: "Tracks" },
  { href: "/breeding", label: "Breeding" },
  { href: "/agents", label: "Agents" },
  { href: "/forum", label: "Forum" },
  { href: "/listings", label: "Listings" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[hsl(150_24%_4%/0.88)] backdrop-blur-xl relative">
      <div aria-hidden="true" className="race-box-strip absolute inset-x-0 bottom-0 h-px rounded-none opacity-75" />
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:px-6">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger
            aria-label="Open navigation menu"
            className="inline-flex items-center justify-center rounded-md p-2 text-[hsl(215_14%_65%)] transition-colors hover:bg-white/[0.05] hover:text-[hsl(210_13%_97%)] md:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="border-white/[0.06] bg-[hsl(150_18%_6%)]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="race-box-strip mt-4" />
            <nav className="mt-8 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-[hsl(210_13%_97%)] transition-colors hover:text-[hsl(142_60%_48%)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="group mr-3 flex items-center gap-2 md:mr-10">
          <Image
            src="/images/logo-mark-new.png"
            alt="GreyhoundIQ"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span
            className="text-[15px] font-semibold text-[hsl(210_13%_97%)]"
          >
            Greyhound<span className="text-[hsl(142_60%_48%)]">IQ</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[hsl(215_14%_65%)] transition-all hover:bg-white/[0.04] hover:text-[hsl(210_13%_97%)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dogs"
            className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-[hsl(215_14%_65%)] transition-all hover:bg-white/[0.04] hover:text-[hsl(210_13%_97%)] sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </Link>

          {user ? (
            <>
              <span className="hidden items-center gap-2 text-[13px] text-[hsl(215_14%_65%)] sm:flex">
                <span className="max-w-[140px] truncate font-medium text-[hsl(210_13%_97%)]">
                  <Link href="/account" className="hover:text-[hsl(142_60%_48%)]">
                    {user.firstName || user.name}
                  </Link>
                </span>
                {badge && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `hsl(${badge.color} / 0.14)`, color: `hsl(${badge.color})` }}
                  >
                    {badge.label}
                  </span>
                )}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center whitespace-nowrap rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="inline-flex items-center whitespace-nowrap rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] font-medium text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06] md:px-3"
              >
                Log in
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center whitespace-nowrap rounded-md bg-[hsl(142_60%_42%)] px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg shadow-[hsl(142_76%_36%/0.18)] transition-all hover:bg-[hsl(142_60%_48%)] md:px-3.5"
              >
                Go Pro
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
