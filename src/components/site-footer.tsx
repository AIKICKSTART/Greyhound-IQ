import Image, { getImageProps } from "next/image";
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
      { href: "/marketplace", label: "Marketplace" },
      { href: "/groups", label: "Groups" },
      { href: "/feed", label: "Feed" },
      { href: "/pulse", label: "Pulse" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
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

const MOBILE_FOOTER_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/pulse", label: "Pulse" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

const FOOTER_BG_DESKTOP = siteAssetUrl("/images/site-footer-finish-line-cinematic.webp");
const FOOTER_BG_MOBILE = siteAssetUrl("/images/site-footer-finish-line-cinematic-mobile.webp");
const LOGO_MAIN = "/images/logo-main-purple-gold.webp";

function FooterBackgroundImage() {
  const common = {
    alt: "",
    className:
      "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center opacity-[0.9]",
    loading: "lazy" as const,
    sizes: "100vw",
  };
  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    height: 900,
    quality: 82,
    src: FOOTER_BG_DESKTOP,
    width: 3201,
  });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    height: 1600,
    quality: 82,
    src: FOOTER_BG_MOBILE,
    width: 1080,
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} alt="" />
    </picture>
  );
}

export function SiteFooter() {
  return (
    <footer className="giq-footer-shell relative isolate mt-14 overflow-hidden">
      <div className="race-box-strip giq-strip-flow relative z-20 h-[3px] rounded-none opacity-90" />
      <FooterBackgroundImage />

      <div className="relative z-20">
        <div className="giq-footer-grid mx-auto max-w-[70rem] px-6 pb-8 pt-12">
          <div className="giq-footer-brand-block max-w-[15rem]">
            <Link
              href="/"
              aria-label="GreyhoundIQ home"
              className="giq-footer-logo relative block h-14 w-[220px] overflow-hidden drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)]"
            >
              <Image
                src={LOGO_MAIN}
                alt="GreyhoundIQ"
                fill
                className="object-contain object-left"
                sizes="220px"
              />
            </Link>
            <p className="giq-mobile-footer-summary">
              Form, breeding, community, and AI racing intelligence.
            </p>
            <p className="giq-body-sm mt-[18px] max-w-[216px]">
              Australian greyhound racing intelligence platform -
              race cards, form, breeding, and AI predictions in one track-side view.
            </p>
            <nav className="giq-mobile-footer-links" aria-label="Essential footer links">
              {MOBILE_FOOTER_LINKS.map((link) => (
                <Link key={`mobile-footer-${link.href}`} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="giq-footer-section">
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

        <div className="giq-footer-bottom mx-auto flex max-w-[70rem] flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-6 pb-7 pt-[18px]">
          <span className="giq-caption">(c) 2026 GreyhoundIQ - An AI Kick Start platform</span>
          <span className="giq-footer-live-status giq-caption inline-flex items-center gap-2">
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
