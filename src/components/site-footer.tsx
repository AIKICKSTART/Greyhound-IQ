import Link from "next/link";
import Image from "next/image";
import { siteAssetUrl } from "@/lib/storage-paths";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { href: "/races", label: "Race Cards" },
      { href: "/results", label: "Results" },
      { href: "/dogs", label: "Dog Search" },
      { href: "/tracks", label: "Tracks" },
      { href: "/listings", label: "Listings" },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/breeding", label: "Breeding" },
      { href: "/statistics", label: "Statistics" },
      { href: "/agents", label: "AI Agents" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/forum", label: "Forum" },
      { href: "/messages", label: "Messages" },
      { href: "/listings", label: "Marketplace" },
      { href: "/account", label: "Account" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/pricing", label: "Pricing" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

const FOOTER_BG = siteAssetUrl("/images/wentworth-track-footer.webp");
const LOGO_MAIN = siteAssetUrl("/images/logo-main-purple-gold.webp");

export function SiteFooter() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-white/[0.08] bg-[hsl(var(--background))]">
      <Image
        src={FOOTER_BG}
        alt=""
        fill
        className="pointer-events-none z-0 object-cover object-[58%_50%] opacity-[0.76]"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(90deg,hsl(var(--background)/0.96)_0%,hsl(var(--surface-1)/0.82)_48%,hsl(var(--surface-1)/0.56)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(180deg,hsl(var(--background)/0.52)_0%,transparent_34%,hsl(var(--background)/0.90)_100%)]"
      />
      <div className="relative z-20 mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-12 grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <div className="relative mb-5 h-24 w-full max-w-sm overflow-hidden rounded-xl shadow-lg shadow-black/35">
              <Image
                src={LOGO_MAIN}
                alt="GreyhoundIQ"
                fill
                className="object-contain object-left"
                sizes="384px"
              />
            </div>
            <p className="max-w-2xl text-2xl font-semibold leading-tight text-[hsl(var(--foreground))] md:text-4xl">
              Track-side intelligence for race night, breeding decisions, and the market between them.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <Link
              href="/races"
              className="giq-button giq-button-primary w-fit px-4 text-sm font-semibold"
            >
              Race cards
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))] md:text-right">
              Built for Australian greyhound racing. 18+ only. Bet responsibly.
            </p>
          </div>
        </div>

        <div className="race-box-strip mb-10 w-56 opacity-85" />
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <div className="relative mb-3 h-14 w-full max-w-[220px] overflow-hidden rounded-lg">
              <Image
                src={LOGO_MAIN}
                alt="GreyhoundIQ"
                fill
                className="object-contain object-left"
                sizes="220px"
              />
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              The smartest greyhound racing data platform in Australia.
              AI predictions, breeding analytics, and real-time form.
            </p>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--primary-light))]"
              >
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-6">
          <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">
            (c) 2026 GreyhoundIQ - 18+ only - Bet responsibly
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
              Built in Australia
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
