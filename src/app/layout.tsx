import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://greyhoundiq.com.au"),
  title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
  description:
    "The smartest greyhound racing data platform in Australia. Real-time race cards, AI predictions, breeding analytics, and community.",
  icons: {
    icon: "/icon.png",
    apple: "/images/logo-mark-new.png",
  },
  openGraph: {
    title: "GreyhoundIQ — Australian Greyhound Racing Intelligence",
    description:
      "Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners.",
    images: ["/images/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} antialiased min-h-screen`}
        style={{ fontFeatureSettings: '"cv01", "ss03", "rlig" 1, "calt" 1' }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[hsl(142_76%_36%)] focus:text-white focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main-content" className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
