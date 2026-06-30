import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import "./globals.css";
import { CookieConsentBanner } from "@/components/cookie-consent";
import { MobileBottomDock } from "@/components/mobile-bottom-dock";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteAssetUrl } from "@/lib/storage-paths";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

const LOGO_MARK = siteAssetUrl("/images/logo-mark-new.png");
const OG_IMAGE = siteAssetUrl("/images/og-image.webp");

export const metadata: Metadata = {
  metadataBase: new URL("https://greyhoundiq.com.au"),
  title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
  description:
    "The smartest greyhound racing data platform in Australia. Real-time race cards, AI predictions, breeding analytics, and community.",
  icons: {
    icon: "/icon.png",
    apple: LOGO_MARK,
  },
  openGraph: {
    title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
    description:
      "Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
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

  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} antialiased min-h-screen`}
        style={{ fontFeatureSettings: '"cv01", "ss03", "rlig" 1, "calt" 1' }}
      >
        <AuthKitProvider initialAuth={initialAuth}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[hsl(142_76%_36%)] focus:text-white focus:text-sm focus:font-semibold"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main id="main-content" className="min-h-screen flex-1">{children}</main>
            <SiteFooter />
          </div>
          <MobileBottomDock />
          <CookieConsentBanner />
        </AuthKitProvider>
      </body>
    </html>
  );
}
