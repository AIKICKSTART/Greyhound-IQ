import Link from "next/link";
import { CookiePreferencePanel } from "@/components/cookie-consent";

export const metadata = {
  title: "Privacy Policy — GreyhoundIQ",
  description: "How GreyhoundIQ handles your data and privacy.",
};

export default function PrivacyPage() {
  return (
    <div className="giq-legal-page mx-auto max-w-3xl px-6 py-16">
      <div className="race-box-strip mb-5 w-40" />
      <h1 className="mb-2 text-3xl text-[hsl(var(--foreground))]">
        Privacy Policy
      </h1>
      <p className="mb-8 text-[13px] text-[hsl(var(--subtle-foreground))]">
        Last updated: 3 July 2026
      </p>

      <div className="giq-legal-body space-y-6 text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        <p>
          GreyhoundIQ is built and operated in Australia. This policy explains
          what data we collect, how we use it, and your rights under the
          Australian Privacy Principles (APPs).
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          What we collect
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-[hsl(var(--foreground))]">Account data:</strong>{" "}
            email, name, organisation, and identity events handled through
            WorkOS.
          </li>
          <li>
            <strong className="text-[hsl(var(--foreground))]">Usage data:</strong>{" "}
            pages viewed, features used, saved preferences, searches, and
            analytics used to operate and improve the service.
          </li>
          <li>
            <strong className="text-[hsl(var(--foreground))]">Payment data:</strong>{" "}
            subscription status, invoices, refunds, and billing history managed
            in Lago. We do not store full card numbers.
          </li>
          <li>
            <strong className="text-[hsl(var(--foreground))]">Racing data:</strong>{" "}
            race cards, form, market, and results data from connected racing
            data providers and public sources.
          </li>
        </ul>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          How we use it
        </h2>
        <p>
          We use data to run GreyhoundIQ, authenticate users through WorkOS,
          manage subscriptions and payment workflows in Lago, send service and
          billing notices, improve features, and comply with legal obligations.
          We do not sell your personal data.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          AI processing
        </h2>
        <p>
          GreyhoundIQ uses AI to generate summaries, rankings, and statistical
          predictions from racing data and user prompts. AI outputs are
          informational only, may be wrong, and should not be treated as betting
          advice or a guarantee of race outcomes.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Data storage and processors
        </h2>
        <p>
          We use WorkOS for identity, Lago for billing records and payment
          workflows, hosting and database providers for the application, and AI
          processing providers for product features. We limit shared data to
          what each processor needs to provide the service.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Data-source safety
        </h2>
        <p>
          GreyhoundIQ connects to racing-data providers and public sources to
          display race information, form, markets, and results. Provider data can
          be delayed, corrected, restricted, or unavailable, and we preserve
          provider attribution and access limits where required.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Your rights
        </h2>
        <p>
          You can request a copy of your data, request deletion, or opt out of
          analytics. Email privacy@greyhoundiq.com.au.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Cookies
        </h2>
        <p>
          We use essential cookies for authentication and optional analytics
          cookies. You can accept or decline optional analytics below; the
          preference is stored in this browser.
        </p>
        <CookiePreferencePanel />

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Responsible racing
        </h2>
        <p>
          GreyhoundIQ is 18+ only. We provide racing intelligence for
          informational and entertainment purposes, not betting advice. Bet
          responsibly and within your means. If you or someone you know has a
          gambling problem, contact{" "}
          <a
            href="https://www.gamblinghelponline.org.au"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--primary-bright))] hover:underline"
          >
            Gambling Help Online
          </a>{" "}
          on 1800 858 858.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Billing and refunds
        </h2>
        <p>
          Lago is our billing source of truth for subscriptions, invoices,
          payment status, and refunds. For billing help, refund requests, or
          disputed charges, contact support through the billing or contact
          channels in the app.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Changes
        </h2>
        <p>
          We&apos;ll update this policy when our practices change. Material
          changes will be announced on the homepage.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Contact
        </h2>
        <p>
          Privacy questions?{" "}
          <Link href="/contact" className="text-[hsl(var(--primary-bright))] hover:underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
