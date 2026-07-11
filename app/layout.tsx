import type { Metadata } from "next";
import "./globals.css";

// Fonts are self-hosted from /public/fonts and declared in globals.css
// (next/font/google removed — it requires fetching from Google CDN at build time,
// which fails on unreliable networks and breaks the production build).

export const metadata: Metadata = {
  title: "White Vintage Bungalow - Heritage Hotel in Nuwara Eliya",
  description: "Experience colonial elegance in Sri Lanka's hill country. White Vintage Bungalow offers luxury accommodation with stunning tea plantation views in Nuwara Eliya.",
  keywords: ["hotel nuwara eliya", "sri lanka hotels", "heritage hotel", "colonial bungalow", "tea country accommodation"],
  authors: [{ name: "White Vintage Bungalow" }],
  openGraph: {
    title: "White Vintage Bungalow - Heritage Hotel",
    description: "Experience colonial elegance in Sri Lanka's hill country",
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
