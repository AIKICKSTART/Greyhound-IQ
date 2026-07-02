import Link from "next/link";

export const metadata = {
  title: "Terms of Service — GreyhoundIQ",
  description: "Terms of service for using GreyhoundIQ.",
};

export default function TermsPage() {
  return (
    <div className="giq-legal-page mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl text-[hsl(var(--foreground))] mb-2 tracking-[-0.03em]">
        Terms of Service
      </h1>
      <p className="text-[13px] text-[hsl(var(--subtle-foreground))] mb-8 tracking-[-0.013em]">
        Last updated: 3 July 2026
      </p>

      <div className="giq-legal-body space-y-6 text-[15px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.011em]">
        <p>
          By using GreyhoundIQ you agree to these terms. If you don&apos;t agree,
          don&apos;t use the service.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          1. The service
        </h2>
        <p>
          GreyhoundIQ is an Australian greyhound racing data platform. We provide
          race cards, form, breeding information, statistics, and AI-generated
          predictions for entertainment and informational purposes only. We are
          operated as a production SaaS service and rely on WorkOS for identity
          and Lago as the billing source of truth.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          2. Accounts and identity
        </h2>
        <p>
          Accounts, authentication, organisation membership, and related identity
          events are handled through WorkOS. You are responsible for keeping
          account access secure and for activity under your account.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          3. 18+ and responsible racing
        </h2>
        <p>
          GreyhoundIQ is intended for users 18 years and over. We do not place
          bets, accept wagers, or provide betting advice. Use the service for
          information and entertainment only, and bet responsibly and within your
          means.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          4. Account & billing
        </h2>
        <p>
          Paid plans, invoices, subscription status, payment workflows, and
          refunds are managed in Lago. You can cancel anytime and keep access
          until the end of your billing period unless your plan terms say
          otherwise.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          5. Refunds and billing support
        </h2>
        <p>
          Refunds are assessed against your plan terms, applicable consumer law,
          and the state of your account in Lago. For billing help, refund
          requests, failed payments, or disputed charges, contact support through
          the billing or contact channels in the app.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          6. AI processing
        </h2>
        <p>
          AI-generated rankings, summaries, and predictions are statistical and
          informational outputs. They may be incomplete, delayed, or wrong, and
          must not be treated as financial, betting, legal, or professional
          advice.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          7. Data accuracy and provider safety
        </h2>
        <p>
          We aggregate data from Betfair, FastTrack, Tasracing, GRNSW and other
          public sources. While we make every effort to keep data accurate, we
          cannot guarantee 100% accuracy. Provider feeds may be delayed,
          corrected, rate-limited, restricted, or unavailable. Do not misuse,
          scrape, resell, or interfere with GreyhoundIQ or provider data access.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          8. Limitation of liability
        </h2>
        <p>
          GreyhoundIQ is provided &quot;as is&quot; without warranty. We are not
          liable for losses incurred from betting decisions, data inaccuracies,
          or service interruptions.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          9. Changes
        </h2>
        <p>
          We may update these terms occasionally. Continued use of GreyhoundIQ
          after changes constitutes acceptance of the new terms.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          10. Contact
        </h2>
        <p>
          Questions about these terms?{" "}
          <Link href="/contact" className="text-[hsl(var(--primary-bright))] hover:underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
