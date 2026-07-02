import Image from "next/image";
import Link from "next/link";
import { siteAssetUrl } from "@/lib/storage-paths";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { href: "/races", label: "Races" },
      { href: "/results", label: "Results" },
      { href: "/dogs", label: "Dogs" },
      { href: "/breeding", label: "Breeding" },
      { href: "/agents", label: "Agents" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
      { href: "/forum", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/terms#responsible-use", label: "Responsible use" },
    ],
  },
];

const FOOTER_BG = siteAssetUrl("/images/site-footer-finish-line-cinematic.webp");
const LOGO_MAIN = siteAssetUrl("/images/logo-main-purple-gold.webp");

export function SiteFooter() {
  return (
    <footer className="giq-footer-shell relative isolate mt-14 overflow-hidden">
      <div className="race-box-strip giq-strip-flow relative z-20 h-[3px] rounded-none opacity-90" />
      <Image
        src={FOOTER_BG}
        alt=""
        fill
        className="pointer-events-none z-0 object-cover opacity-[0.38]"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_82%_0%,hsl(var(--primary)/0.16),transparent_42%),linear-gradient(180deg,hsl(var(--background)/0.48)_0%,hsl(var(--background)/0.64)_58%,hsl(var(--background)/0.92)_100%)]"
      />

      <div className="relative z-20">
        <div className="giq-footer-grid mx-auto max-w-[70rem] px-6 pb-8 pt-12">
          <div className="max-w-80">
            <Link
              href="/"
              aria-label="GreyhoundIQ home"
              className="relative block h-14 w-[220px] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)]"
            >
              <Image
                src={LOGO_MAIN}
                alt="GreyhoundIQ"
                fill
                className="object-contain object-left"
                sizes="220px"
              />
            </Link>
            <p className="giq-body-sm mt-[18px] max-w-[280px]">
              Australian greyhound racing intelligence platform -
              race cards, form, breeding, and AI predictions in one track-side view.
            </p>
            <p className="giq-micro mt-4 text-[hsl(var(--subtle-foreground))]">
              Not a wagering service - 18+
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="giq-eyebrow text-[hsl(var(--secondary-light))]">
                {section.title}
              </h4>
              <ul className="mt-4 flex list-none flex-col gap-[11px] p-0">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-8 items-center text-[13px] text-[hsl(var(--muted-foreground))] no-underline transition-colors hover:text-[hsl(var(--secondary-light))]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto flex max-w-[70rem] flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-6 pb-7 pt-[18px]">
          <span className="giq-caption">(c) 2026 GreyhoundIQ - An AI Kick Start platform</span>
          <span className="giq-caption inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="pulse-glow h-1.5 w-1.5 rounded-full bg-[hsl(142_70%_55%)]"
            />
            National feeds live - updated every 5 min
          </span>
        </div>
      </div>
    </footer>
  );
}
