import { Mail, MessageSquare, GitBranch } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = {
  title: "Contact — GreyhoundIQ",
  description: "Get in touch with the GreyhoundIQ team. Support, partnerships, feedback.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    detail: "support@greyhoundiq.com.au",
    description: "For support, billing, and general questions. We respond within 24 hours.",
  },
  {
    icon: MessageSquare,
    title: "Discord",
    detail: "Coming soon",
    description: "Community chat, real-time support, and race-night discussion.",
  },
  {
    icon: GitBranch,
    title: "GitHub",
    detail: "github.com/greyhoundiq",
    description: "Roadmap, issues, and feature requests. Open source where it makes sense.",
  },
];

export default function ContactPage() {
  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        badge="CONTACT"
        badgeColor="primary"
        title={
          <>
            Talk to us.
            <br />
            <span className="gradient-text">We&apos;re listening.</span>
          </>
        }
        subtitle="Support, partnerships, feedback, or just to say hi. Real humans read these."
      />

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="giq-panel giq-panel-hover p-6 text-center"
              >
                <div className="giq-icon-plate mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                </div>
                <h3
                  className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-1 tracking-[-0.015em]"
                >
                  {c.title}
                </h3>
                <p
                  className="text-[12px] font-mono text-[hsl(var(--primary-bright))] mb-2"
                >
                  {c.detail}
                </p>
                <p
                  className="text-[12px] text-[hsl(var(--subtle-foreground))] leading-relaxed tracking-[-0.013em]"
                >
                  {c.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-20 text-center">
        <div className="giq-panel p-8">
          <h2
            className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2 tracking-[-0.02em]"
          >
            18+ only · Bet responsibly
          </h2>
          <p
            className="text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.013em]"
          >
            GreyhoundIQ is a data platform, not a bookmaker. We don&apos;t take
            bets and we don&apos;t encourage gambling. If you or someone you know
            has a gambling problem, contact{" "}
            <a
              href="https://www.gamblinghelponline.org.au"
              className="text-[hsl(var(--primary-bright))] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gambling Help Online
            </a>{" "}
            on 1800 858 858.
          </p>
        </div>
      </section>
    </div>
  );
}
