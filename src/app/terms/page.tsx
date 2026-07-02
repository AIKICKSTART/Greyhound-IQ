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
        Last updated: 28 June 2026
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
          predictions for entertainment and informational purposes only.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          2. 18+ only
        </h2>
        <p>
          GreyhoundIQ is intended for users 18 years and over. By using the service
          you confirm you meet this requirement. We do not knowingly collect data
          from anyone under 18.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          3. No betting advice
        </h2>
        <p>
          GreyhoundIQ is a data platform. We do not place bets, accept wagers, or
          provide betting advice. AI predictions are statistical estimates, not
          guarantees. Bet responsibly and within your means.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          4. Account & billing
        </h2>
        <p>
          Paid plans are billed monthly or annually via Stripe. You can cancel
          anytime and keep access until the end of your billing period. We
          offer a 14-day money-back guarantee on new paid subscriptions.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          5. Data accuracy
        </h2>
        <p>
          We aggregate data from Betfair, FastTrack, Tasracing, GRNSW and other
          public sources. While we make every effort to keep data accurate, we
          cannot guarantee 100% accuracy. Use at your own discretion.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          6. Limitation of liability
        </h2>
        <p>
          GreyhoundIQ is provided &quot;as is&quot; without warranty. We are not
          liable for losses incurred from betting decisions, data inaccuracies,
          or service interruptions.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          7. Changes
        </h2>
        <p>
          We may update these terms occasionally. Continued use of GreyhoundIQ
          after changes constitutes acceptance of the new terms.
        </p>

        <h2 className="text-[20px] text-[hsl(var(--foreground))] mt-8 mb-3 tracking-[-0.02em]">
          8. Contact
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
