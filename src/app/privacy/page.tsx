import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — GreyhoundIQ",
  description: "How GreyhoundIQ handles your data and privacy.",
};

export default function PrivacyPage() {
  return (
    <div className="fade-in mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl text-[hsl(210_13%_97%)] mb-2 tracking-[-0.03em]">
        Privacy Policy
      </h1>
      <p className="text-[13px] text-[hsl(220_7%_42%)] mb-8 tracking-[-0.013em]">
        Last updated: 28 June 2026
      </p>

      <div className="space-y-6 text-[15px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.011em]">
        <p>
          GreyhoundIQ is built and operated in Australia. This policy explains
          what data we collect, how we use it, and your rights under the
          Australian Privacy Principles (APPs).
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          What we collect
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-[hsl(210_13%_97%)]">Account data:</strong>{" "}
            email, name, subscription status (via Supabase Auth and Stripe).
          </li>
          <li>
            <strong className="text-[hsl(210_13%_97%)]">Usage data:</strong>{" "}
            pages viewed, features used, search queries (anonymised analytics).
          </li>
          <li>
            <strong className="text-[hsl(210_13%_97%)]">Payment data:</strong>{" "}
            handled by Stripe — we never see or store card numbers.
          </li>
        </ul>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          How we use it
        </h2>
        <p>
          To operate the service, send billing emails, improve features based on
          usage, and comply with legal obligations. We do not sell your data.
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Data storage
        </h2>
        <p>
          Data is stored on Supabase (Australia region) and Stripe (US, for
          payments only). Backups run daily.
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Your rights
        </h2>
        <p>
          You can request a copy of your data, request deletion, or opt out of
          analytics. Email privacy@greyhoundiq.com.au.
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Cookies
        </h2>
        <p>
          We use essential cookies for authentication and optional analytics
          cookies (you can opt out via your browser settings or our cookie
          banner — coming soon).
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Responsible gambling
        </h2>
        <p>
          GreyhoundIQ is 18+ only. We display responsible gambling messaging
          site-wide. If you or someone you know has a gambling problem, contact{" "}
          <a
            href="https://www.gamblinghelponline.org.au"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(142_60%_48%)] hover:underline"
          >
            Gambling Help Online
          </a>{" "}
          on 1800 858 858.
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Changes
        </h2>
        <p>
          We&apos;ll update this policy when our practices change. Material
          changes will be announced on the homepage.
        </p>

        <h2 className="text-[20px] text-[hsl(210_13%_97%)] mt-8 mb-3 tracking-[-0.02em]">
          Contact
        </h2>
        <p>
          Privacy questions?{" "}
          <Link href="/contact" className="text-[hsl(142_60%_48%)] hover:underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}