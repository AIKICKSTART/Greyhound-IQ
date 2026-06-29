import Link from "next/link";
import { Search, Menu } from "lucide-react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/results", label: "Results" },
  { href: "/dogs", label: "Dogs" },
  { href: "/tracks", label: "Tracks" },
  { href: "/breeding", label: "Breeding" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[hsl(222_7%_4%/0.8)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger
            aria-label="Open navigation menu"
            className="inline-flex items-center justify-center rounded-md p-2 text-[hsl(215_14%_65%)] hover:bg-white/[0.05] hover:text-[hsl(210_13%_97%)] transition-colors md:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="bg-[hsl(222_6%_7%)] border-white/[0.06]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="flex flex-col gap-4 mt-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-[hsl(210_13%_97%)] hover:text-[hsl(142_60%_48%)] transition-colors font-medium tracking-[-0.011em]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-10 group">
          <Image
            src="/images/logo-mark-new.png"
            alt="GreyhoundIQ"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span
            className="text-[15px] font-semibold tracking-tight text-[hsl(210_13%_97%)] tracking-[-0.02em]"
          >
            Greyhound<span className="text-[hsl(142_60%_48%)]">IQ</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-[13px] font-medium text-[hsl(215_14%_65%)] hover:text-[hsl(210_13%_97%)] hover:bg-white/[0.04] rounded-md transition-all font-medium tracking-[-0.013em]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <Link
            href="/dogs"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] text-[hsl(215_14%_65%)] hover:text-[hsl(210_13%_97%)] hover:bg-white/[0.04] transition-all font-medium"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </Link>

          <Link
            href="/pricing"
            className="inline-flex items-center rounded-md bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-lg shadow-[hsl(142_76%_36%/0.2)] hover:shadow-[hsl(142_76%_36%/0.35)] hover:brightness-110 transition-all tracking-[-0.013em]"
          >
            Go Pro
          </Link>
        </div>
      </div>
    </header>
  );
}
