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
  return (
    <div className="giq-panel p-8 text-center">
      <div className="giq-icon-plate mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
        <Lock
          className={`h-5 w-5 ${
            minTier === "pro_plus"
              ? "text-[hsl(var(--secondary-light))]"
              : "text-[hsl(var(--primary-light))]"
          }`}
        />
      </div>
      <h3 className="text-[17px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]">
        {feature ?? "This feature"} is a {tierName} feature
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.013em]">
        {user
          ? `Upgrade to ${tierName} to unlock this.`
          : `Sign in and upgrade to ${tierName} to unlock this.`}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Link
          href="/pricing"
          className={`giq-button px-4 text-[13px] font-semibold ${
            minTier === "pro_plus" ? "giq-button-gold" : "giq-button-primary"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          See {tierName} plans
        </Link>
        {!user && (
          <a
            href="/sign-in"
            className="giq-button giq-button-glass px-4 text-[13px] font-medium"
          >
            Sign in
          </a>
        )}
      </div>
    </div>
  );
}
