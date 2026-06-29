import Link from "next/link";
import { Lock, Sparkles, Crown } from "lucide-react";
import { getCurrentUser, hasTier, type Tier } from "@/lib/auth";

interface ProGateProps {
  minTier: Tier;
  feature?: string;
  children: React.ReactNode;
}

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
};

// Renders children only when the signed-in user meets minTier. Otherwise shows
// a themed upsell prompting sign-in or upgrade. Server component.
export async function ProGate({ minTier, feature, children }: ProGateProps) {
  const user = await getCurrentUser();

  if (user && hasTier(user.tier, minTier)) {
    return <>{children}</>;
  }

  const Icon = minTier === "pro_plus" ? Crown : Sparkles;
  const tierName = TIER_LABEL[minTier];
  const accent = minTier === "pro_plus" ? "25 95% 53%" : "142 60% 48%";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: `hsl(${accent} / 0.12)` }}
      >
        <Lock className="h-5 w-5" style={{ color: `hsl(${accent})` }} />
      </div>
      <h3 className="text-[17px] font-semibold text-[hsl(210_13%_97%)] tracking-[-0.02em]">
        {feature ?? "This feature"} is a {tierName} feature
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.013em]">
        {user
          ? `Upgrade to ${tierName} to unlock this.`
          : `Sign in and upgrade to ${tierName} to unlock this.`}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all hover:brightness-110"
          style={{ background: `hsl(${accent})` }}
        >
          <Icon className="h-3.5 w-3.5" />
          See {tierName} plans
        </Link>
        {!user && (
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
