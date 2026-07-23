import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "@/lib/workos-env";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { getCurrentUser, hasTier, isModeratorRole } from "@/lib/auth";
import {
  countUnreadMessagesByConversation,
  listConversationsForProfile,
} from "@/lib/conversation-service";
import {
  HubConversationDock,
  type HubDockConversation,
  type HubDockFriend,
  type HubDockFriendRequest,
} from "@/components/hub/hub-conversation-dock";
import { MobileBottomDock } from "@/components/mobile-bottom-dock";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeRouteContent } from "@/components/home-route-content";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
} from "@/components/json-ld";
import { siteAssetUrl } from "@/lib/storage-paths";
import { conversationRealtimeChannel } from "@/lib/realtime-service";
import {
  listFriendRequestsForProfile,
  listFriendsForProfile,
} from "@/lib/friend-service";
import { InteractiveHelp } from "@/components/interactive-help";
import { DemoReadOnlyGuard } from "@/components/demo-read-only-guard";
import { NetworkRecoveryBanner } from "@/components/network-recovery-banner";
import { AuthenticationNavigationFeedback } from "@/components/authentication-navigation-feedback";
import {
  DEMO_ADMIN_DISPLAY_NAME,
  DEMO_SUPPRESS_OVERLAYS_HEADER,
  isFullAccessDemo,
} from "@/lib/demo-access";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

const OG_IMAGE = siteAssetUrl("/images/og-image.webp");

// viewport-fit=cover lets the app paint edge-to-edge on notched phones; the
// safe-area-inset env() paddings in components handle the cutouts. Required
// for the PWA / wrapped-app (Capacitor) install to look native.
export const viewport: Viewport = {
  themeColor: "#08050B",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://greyhoundsiq.com.au"),
  // iOS "Add to Home Screen" opens full-screen app mode instead of Safari chrome.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GreyhoundIQ",
  },
  title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
  description:
    "The smartest greyhound racing data platform in Australia. Real-time race cards, AI predictions, breeding analytics, and community.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "GreyhoundIQ",
    url: "https://greyhoundsiq.com.au",
    title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
    description:
      "Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "GreyhoundIQ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
    description:
      "Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners.",
    images: [OG_IMAGE],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fullAccessDemo = isFullAccessDemo();
  const auth = fullAccessDemo ? { user: null as null } : await withAuth();
  const initialAuth = { ...auth };
  delete (initialAuth as { accessToken?: unknown }).accessToken;
  const suppressDemoOverlays =
    (await headers()).get(DEMO_SUPPRESS_OVERLAYS_HEADER) === "1";

  // The isolated Design Lab/demo runtime must not read production-backed user
  // or conversation data. Its personas are synthetic and are selected inside
  // the preview surface rather than inferred from a real session.
  const user = fullAccessDemo ? null : await getCurrentUser();
  let conversations: HubDockConversation[] = [];
  let friends: HubDockFriend[] = [];
  let requests: HubDockFriendRequest[] = [];
  let unreadMessages = 0;
  if (user?.dbUserId && user.profileId) {
    const current = {
      dbUserId: user.dbUserId,
      profileId: user.profileId,
      profileRole: user.role ?? "member",
      tier: user.tier,
    };
    const [
      conversationRecords,
      unreadByConversation,
      friendRecords,
      requestRecords,
    ] = await Promise.all([
      listConversationsForProfile(current),
      countUnreadMessagesByConversation(current),
      listFriendsForProfile(current),
      listFriendRequestsForProfile(current),
    ]);
    unreadMessages = Array.from(unreadByConversation.values()).reduce(
      (total, count) => total + count,
      0,
    );
    conversations = conversationRecords.slice(0, 12).map((conversation) => {
      const other =
        conversation.participantAId === user.profileId
          ? conversation.participantB
          : conversation.participantA;
      const otherActor =
        conversation.participantAId === user.profileId
          ? conversation.participantBActor
          : conversation.participantAActor;
      const message = conversation.messages[0];
      const sentByCurrentUser = message?.senderId === user.profileId;
      return {
        id: conversation.id,
        otherName: otherActor?.displayName ?? other.displayName,
        otherAvatarUrl: otherActor?.avatarUrl ?? other.avatarUrl,
        otherProfileId: other.id,
        preview: message
          ? `${sentByCurrentUser ? "You: " : ""}${message.body}`
          : "Conversation started",
        attachmentCount: message?._count.media ?? 0,
        unread: unreadByConversation.get(conversation.id) ?? 0,
        personToPerson:
          conversation.participantAActor?.kind !== "page" &&
          conversation.participantBActor?.kind !== "page",
        realtimeChannel: conversationRealtimeChannel(conversation.id),
      };
    });
    friends = friendRecords.map((friend) => ({
      friendshipId: friend.friendshipId,
      profileId: friend.profileId,
      displayName: friend.displayName,
      avatarUrl: friend.avatarUrl,
      conversationId: friend.conversationId,
    }));
    requests = requestRecords.map((request) => ({
      friendshipId: request.friendshipId,
      direction: request.direction,
      profileId: request.profileId,
      displayName: request.displayName,
      avatarUrl: request.avatarUrl,
      kennelName: request.kennelName,
      state: request.state,
    }));
  }

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        data-demo-read-only={fullAccessDemo ? "true" : undefined}
        className={`${inter.className} ${user ? "giq-member-shell" : "giq-public-shell"} antialiased min-h-screen`}
        style={{ fontFeatureSettings: '"cv01", "ss03", "rlig" 1, "calt" 1' }}
      >
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <AuthKitProvider initialAuth={initialAuth}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:text-white focus:text-sm focus:font-semibold"
          >
            Skip to main content
          </a>
          <NetworkRecoveryBanner />
          <AuthenticationNavigationFeedback />
          <div className="flex min-h-screen flex-col">
            <SiteHeader user={user} unreadMessages={unreadMessages} />
            {fullAccessDemo && !suppressDemoOverlays ? (
              <DemoReadOnlyGuard personaName={DEMO_ADMIN_DISPLAY_NAME} />
            ) : null}
            <main
              id="main-content"
              data-onboarding-target="racing-page-content community-page-content public-page-content marketplace-page-content agents-page-content design-lab-page-content"
              className="flex-1"
            >
              {children}
            </main>
            {user ? (
              <HomeRouteContent home={<SiteFooter />} app={null} />
            ) : (
              <SiteFooter />
            )}
          </div>
          {!suppressDemoOverlays && !fullAccessDemo ? (
            <InteractiveHelp
              allowAutomaticOpen={Boolean(user)}
              allowContextualAutomaticOpen
              firstName={user?.firstName || user?.name || "Visitor"}
              profileScope={user?.profileId}
              role={user?.role ?? "visitor"}
              showFloatingLauncher
              tier={user?.tier ?? "free"}
            />
          ) : null}
          {user && !suppressDemoOverlays && (
            <>
              <MobileBottomDock
                unreadMessages={unreadMessages}
                canAccessAdmin={isModeratorRole(user.role)}
                tier={user.tier}
              />
              <HubConversationDock
                mode="floating"
                externalLauncher
                layout={user.messengerLayout}
                conversations={conversations}
                friends={friends}
                requests={requests}
                selfProfileId={user.profileId!}
                canStartCall={hasTier(user.tier, "pro_plus")}
              />
            </>
          )}
          {!suppressDemoOverlays && !fullAccessDemo ? (
            <CookieConsentBanner />
          ) : null}
        </AuthKitProvider>
      </body>
    </html>
  );
}
