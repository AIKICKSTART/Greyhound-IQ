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
        Last updated: 28 June 2026
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
            email, name, subscription status (via Supabase Auth and Stripe).
          </li>
          <li>
            <strong className="text-[hsl(var(--foreground))]">Usage data:</strong>{" "}
            pages viewed, features used, search queries (anonymised analytics).
          </li>
          <li>
            <strong className="text-[hsl(var(--foreground))]">Payment data:</strong>{" "}
            handled by Stripe — we never see or store card numbers.
          </li>
        </ul>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          How we use it
        </h2>
        <p>
          To operate the service, send billing emails, improve features based on
          usage, and comply with legal obligations. We do not sell your data.
        </p>

        <h2 className="mb-3 mt-8 text-[20px] text-[hsl(var(--foreground))]">
          Data storage
        </h2>
        <p>
          Data is stored on Supabase (Australia region) and Stripe (US, for
          payments only). Backups run daily.
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
          Responsible gambling
        </h2>
        <p>
          GreyhoundIQ is 18+ only. We display responsible gambling messaging
          site-wide. If you or someone you know has a gambling problem, contact{" "}
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
