import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/lib/workos-env";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadMessagesTotal } from "@/lib/conversation-service";
import { MobileBottomDock } from "@/components/mobile-bottom-dock";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeRouteContent } from "@/components/home-route-content";
import { JsonLd, organizationSchema, websiteSchema } from "@/components/json-ld";
import { AuthenticationNavigationFeedback } from "@/components/authentication-navigation-feedback";
import { siteAssetUrl } from "@/lib/storage-paths";

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
  const auth = await withAuth();
  const initialAuth = { ...auth };
  delete (initialAuth as { accessToken?: unknown }).accessToken;

  const user = await getCurrentUser();
  const unreadMessages =
    user?.dbUserId && user.profileId
      ? await countUnreadMessagesTotal({
          dbUserId: user.dbUserId,
          profileId: user.profileId,
          profileRole: user.role ?? "member",
          tier: user.tier,
        })
      : 0;

  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} ${user ? "giq-member-shell" : "giq-public-shell"} antialiased min-h-screen`}
        style={{ fontFeatureSettings: '"cv01", "ss03", "rlig" 1, "calt" 1' }}
      >
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <AuthKitProvider initialAuth={initialAuth}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:text-white focus:text-sm focus:font-semibold"
          >
          <AuthenticationNavigationFeedback />
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            <SiteHeader user={user} unreadMessages={unreadMessages} />
            <main id="main-content" className="flex-1">{children}</main>
            {user ? (
              <HomeRouteContent home={<SiteFooter />} app={null} />
            ) : (
              <SiteFooter />
            )}
          </div>
          {user && (
            <HomeRouteContent
              home={null}
              app={<MobileBottomDock unreadMessages={unreadMessages} />}
            />
          )}
          <CookieConsentBanner />
        </AuthKitProvider>
      </body>
    </html>
  );
}
