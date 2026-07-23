import "server-only";

import {
  findMarketplaceBoostPackage,
  type MarketplaceBoostPackageId,
} from "@/components/advertising-product-contract";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { getStripeClient } from "@/lib/billing/stripe-client";
import type { StripeCheckoutEnv } from "@/lib/billing/stripe-env";
import {
  getOrCreateStripeCustomer,
  stripeMutationOptions,
} from "@/lib/billing/stripe-service";
import { withDbRequestContext } from "@/lib/db-context";
import { assertPaidFeatureAccess } from "@/lib/tier-access";

const BOOST_CURRENCY = "aud";

// A signed-in Pro seller buys a boost for one of their OWN active, approved
// listings. Price, currency and package are resolved server-side only; the
// caller supplies just listingId + packageId. Amount is never trusted from the
// client. Webhook activation lives in stripe-webhooks.ts (test mode).
export async function createMarketplaceBoostCheckoutSession({
  current,
  env,
  listingId,
  packageId,
}: {
  current: CurrentUserProfile;
  env: StripeCheckoutEnv;
  listingId: string;
  packageId: MarketplaceBoostPackageId;
}) {
  assertPaidFeatureAccess(current);

  const pkg = findMarketplaceBoostPackage(packageId);
  if (!pkg) throw new Error("marketplace_boost.unknown_package");

  const listing = await getBoostableListing(current, listingId);
  if (!listing) throw new Error("marketplace_boost.listing_not_found");
  if (
    listing.status !== "active" ||
    listing.moderationStatus !== "approved"
  ) {
    throw new Error("marketplace_boost.listing_not_eligible");
  }

  const customerId = await getOrCreateStripeCustomer(current, env);

  const successUrl = new URL("/account/listings", env.appUrl);
  successUrl.searchParams.set("boost", "success");
  successUrl.searchParams.set("listing", listing.id);
  const cancelUrl = new URL("/account/listings", env.appUrl);
  cancelUrl.searchParams.set("boost", "cancelled");
  cancelUrl.searchParams.set("listing", listing.id);

  return getStripeClient(env.secretKey).checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: current.dbUserId,
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: BOOST_CURRENCY,
            unit_amount: pkg.priceCentsIncludingGst,
            product_data: {
              name: `GreyhoundsIQ ${pkg.name}`,
              description: `${pkg.viewableImpressions.toLocaleString("en-AU")} viewable Marketplace card impressions · up to ${pkg.maximumDays} days · GST included`,
            },
          },
        },
      ],
      metadata: {
        kind: "marketplace_boost",
        listingId: listing.id,
        packageId: pkg.id,
        profileId: current.profileId,
        userId: current.dbUserId,
        workosUserId: current.id,
      },
      payment_intent_data: {
        metadata: {
          kind: "marketplace_boost",
          listingId: listing.id,
          userId: current.dbUserId,
        },
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    },
    stripeMutationOptions("boost-checkout", current.dbUserId),
  );
}

// RLS-scoped ownership fetch: the seller must own the listing (explicit
// profileId filter plus request-context RLS). Only the eligibility fields are
// needed, so this avoids the heavy listing-service include chain.
async function getBoostableListing(
  current: CurrentUserProfile,
  listingId: string,
) {
  return withDbRequestContext(current, (tx) =>
    tx.listing.findFirst({
      where: { id: listingId, profileId: current.profileId },
      select: { id: true, status: true, moderationStatus: true },
    }),
  );
}
