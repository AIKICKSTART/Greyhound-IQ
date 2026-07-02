import Link from "next/link";
import { CheckCircle2, GitBranch, Lock, Mail, MessageSquare } from "lucide-react";
import { createSupportTicket } from "@/app/actions";
import { PageHero } from "@/components/page-hero";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact — GreyhoundIQ",
  description: "Get in touch with the GreyhoundIQ team. Support, partnerships, feedback.",
};

type ContactPageProps = {
  searchParams: Promise<{ ticket?: string | string[] }>;
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

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const ticketCreated = params.ticket === "created";

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

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="giq-panel p-6 md:p-8">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--primary-bright))]">
              Support request
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
              Create a ticket
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Send a short note and we will follow up from your account details.
            </p>
          </div>

          {ticketCreated && (
            <div className="mt-5 flex items-center gap-3 rounded-lg border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.08)] p-4 text-[13px] text-[hsl(var(--foreground))]">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
              Your support request has been sent.
            </div>
          )}

          {user ? (
            <form action={createSupportTicket} className="mt-6 grid gap-4">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Category
                </span>
                <select
                  name="category"
                  required
                  className="giq-form-control mt-2 px-3 py-2"
                  defaultValue="general"
                >
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="feedback">Feedback</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Message
                </span>
                <textarea
                  name="body"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={7}
                  className="giq-form-control giq-textarea mt-2 px-3 py-2"
                  placeholder="Describe what you need help with."
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                  We will use your signed-in account for follow-up.
                </p>
                <SubmitButton pendingLabel="Sending...">Send request</SubmitButton>
              </div>
            </form>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-[48px_1fr_auto] md:items-center">
              <div className="giq-icon-plate flex h-12 w-12 items-center justify-center rounded-lg">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Sign in to create a ticket
                </h3>
                <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                  Support requests are connected to your account.
                </p>
              </div>
              <Link
                href="/sign-in"
                className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
              >
                Sign in
              </Link>
            </div>
          )}
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
