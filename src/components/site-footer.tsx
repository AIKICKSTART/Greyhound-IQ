import Link from "next/link";
import Image from "next/image";

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

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="race-box-strip mb-10 w-48 opacity-75" />
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/images/logo-mark-new.png"
                alt="GreyhoundIQ"
                width={28}
                height={28}
                className="rounded-lg"
              />
            <span
                className="text-[15px] font-semibold text-[hsl(210_13%_97%)]"
              >
                Greyhound<span className="text-[hsl(142_60%_48%)]">IQ</span>
              </span>
            </div>
            <p
              className="max-w-xs text-[13px] leading-relaxed text-[hsl(215_14%_65%)]"
            >
              The smartest greyhound racing data platform in Australia.
              AI predictions, breeding analytics, and real-time form.
            </p>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                className="mb-3 text-[11px] font-semibold uppercase text-[hsl(220_7%_58%)]"
              >
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[hsl(215_14%_65%)] transition-colors hover:text-[hsl(210_13%_97%)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.05] pt-6">
          <p
            className="text-[11px] text-[hsl(220_7%_42%)]"
          >
            (c) 2026 GreyhoundIQ - 18+ only - Bet responsibly
          </p>
          <div className="flex items-center gap-4">
            <span
              className="text-[11px] text-[hsl(220_7%_42%)]"
            >
              Built in Australia
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
