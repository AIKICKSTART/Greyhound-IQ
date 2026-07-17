import { CircleAlert, ExternalLink, HeartHandshake, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";

export const metadata = {
  title: "Responsible Use — GreyhoundIQ",
  description:
    "How to use GreyhoundIQ racing intelligence responsibly, understand its limits, and find Australian gambling support.",
  alternates: { canonical: "/responsible-use" },
  openGraph: {
    title: "Responsible Use — GreyhoundIQ",
    description:
      "Practical guidance for using GreyhoundIQ racing data and AI outputs responsibly.",
    url: "/responsible-use",
    type: "website",
  },
};

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Information, not betting advice",
    body: "GreyhoundIQ presents racing data, form, statistics and generated analysis for information and entertainment. It does not place or accept wagers, and no output guarantees an outcome.",
  },
  {
    icon: CircleAlert,
    title: "Data can change",
    body: "Provider feeds may be incomplete, delayed, corrected or unavailable. Check the displayed source and update time, and confirm important information with an official source.",
  },
  {
    icon: HeartHandshake,
    title: "Stay in control",
    body: "GreyhoundIQ is for adults aged 18 and over. Never chase losses, never spend more than you can afford, and step away if racing is affecting your wellbeing, finances or relationships.",
  },
] as const;

export default function ResponsibleUsePage() {
  return (
    <main className="giq-legal-page mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="giq-eyebrow text-[hsl(var(--secondary-light))]">Responsible use</p>
      <PageTitle className="mt-3 max-w-3xl">
        Racing intelligence should help you understand the race—not pressure you to bet.
      </PageTitle>
      <p className="mt-5 max-w-3xl text-[15px] leading-7 text-[hsl(var(--muted-foreground))]">
        Use GreyhoundIQ as one source of information, keep the limits of racing data and AI
        analysis in view, and make choices that protect your wellbeing.
      </p>

      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Responsible use principles">
        {PRINCIPLES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="giq-panel p-5">
            <Icon className="size-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">{title}</h2>
            <p className="mt-3 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">{body}</p>
          </article>
        ))}
      </section>

      <section className="giq-panel mt-6 p-5 sm:p-7" aria-labelledby="support-heading">
        <h2 id="support-heading" className="text-2xl font-semibold text-[hsl(var(--foreground))]">
          Support is available
        </h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-7 text-[hsl(var(--muted-foreground))]">
          If gambling is causing harm, you can speak confidentially with Gambling Help Online
          24 hours a day. Call <a className="font-semibold text-[hsl(var(--foreground))] underline" href="tel:1800858858">1800 858 858</a> or use its online support service.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            className="giq-liquid-purple-button min-h-11 px-5 text-[13px] font-semibold"
            href="https://www.gamblinghelponline.org.au"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Gambling Help Online
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
          <Link className="giq-outline-action min-h-11" href="/contact">
            Contact GreyhoundIQ
          </Link>
        </div>
      </section>

      <p className="mt-6 text-[12px] leading-6 text-[hsl(var(--subtle-foreground))]">
        For the legal conditions governing GreyhoundIQ, read the <Link className="underline" href="/terms">Terms of Service</Link>. For information about personal data, read the <Link className="underline" href="/privacy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
