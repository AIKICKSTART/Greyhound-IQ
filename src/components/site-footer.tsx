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

const FOOTER_BG = siteAssetUrl("/images/site-footer-racing-bg.webp");
const LOGO_MARK = siteAssetUrl("/images/logo-mark-new.webp");
const LOGO_WORDMARK = siteAssetUrl("/images/logo-wordmark.webp");

export function SiteFooter() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-white/[0.08] bg-[hsl(150_30%_3%)]">
      <Image
        src={FOOTER_BG}
        alt=""
        fill
        className="pointer-events-none z-0 object-cover object-[58%_50%] opacity-[0.76]"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(90deg,hsl(150_30%_3%/0.96)_0%,hsl(150_24%_4%/0.82)_48%,hsl(150_24%_4%/0.56)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(180deg,hsl(150_30%_3%/0.52)_0%,transparent_34%,hsl(150_30%_3%/0.90)_100%)]"
      />
      <div className="relative z-20 mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-12 grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-xl shadow-lg shadow-black/35">
                <Image
                  src={LOGO_MARK}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
              <div className="relative h-12 w-64 overflow-hidden">
                <Image
                  src={LOGO_WORDMARK}
                  alt="GreyhoundIQ"
                  fill
                  className="object-contain object-left"
                  sizes="256px"
                />
              </div>
            </div>
            <p className="max-w-2xl text-2xl font-semibold leading-tight text-[hsl(210_13%_97%)] md:text-4xl">
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
            <p className="max-w-sm text-sm leading-relaxed text-[hsl(215_14%_72%)] md:text-right">
              Built for Australian greyhound racing. 18+ only. Bet responsibly.
            </p>
          </div>
        </div>

        <div className="race-box-strip mb-10 w-56 opacity-85" />
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="relative h-8 w-8 overflow-hidden rounded-lg">
                <Image
                  src={LOGO_MARK}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>
              <div className="relative h-8 w-40 overflow-hidden">
                <Image
                  src={LOGO_WORDMARK}
                  alt="GreyhoundIQ"
                  fill
                  className="object-contain object-left"
                  sizes="160px"
                />
              </div>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-[hsl(215_14%_72%)]">
              The smartest greyhound racing data platform in Australia.
              AI predictions, breeding analytics, and real-time form.
            </p>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(142_60%_62%)]"
              >
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[hsl(215_14%_74%)] transition-colors hover:text-[hsl(210_13%_97%)]"
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
          <p className="text-[11px] text-[hsl(215_14%_60%)]">
            (c) 2026 GreyhoundIQ - 18+ only - Bet responsibly
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-[hsl(215_14%_60%)]">
              Built in Australia
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
