import type { Metadata } from "next";
import "./globals.css";

// Fonts are self-hosted from /public/fonts and declared in globals.css
// (next/font/google removed — it requires fetching from Google CDN at build time,
// which fails on unreliable networks and breaks the production build).

export const metadata: Metadata = {
  title: "White Vintage Bungalow - Boutique Guest Bungalow in Nuwara Eliya",
  description: "Experience vintage charm in Sri Lanka's hill country. White Vintage Bungalow is a family-run guest bungalow with cosy rooms and stunning tea plantation views in Nuwara Eliya.",
  keywords: ["hotel nuwara eliya", "sri lanka hotels", "guest house nuwara eliya", "vintage bungalow", "tea country accommodation"],
  authors: [{ name: "White Vintage Bungalow" }],
  openGraph: {
    title: "White Vintage Bungalow - Boutique Guest Bungalow",
    description: "Experience vintage charm in Sri Lanka's hill country",
    url: "https://whitevintage.com",
    siteName: "White Vintage Bungalow",
    locale: "en_US",
    type: "website",
  },
};

import { Providers } from "@/components/Providers";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <WhatsAppButton />
      </body>
    </html>
  );
}
