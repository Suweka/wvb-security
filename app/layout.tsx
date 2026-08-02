// Root layout — wraps every page in the app. This is where the <html> and
// <body> tags live (Next.js App Router requires the root layout to render
// them), plus global metadata, the theme-flash-prevention script, and the
// site-wide widgets (chat + WhatsApp buttons) that should appear on every page.
import type { Metadata, Viewport } from "next";
import "./globals.css";

// Fonts are self-hosted from /public/fonts and declared in globals.css
// (next/font/google removed — it requires fetching from Google CDN at build time,
// which fails on unreliable networks and breaks the production build).

// `metadata` is a special Next.js export: the framework automatically turns
// this object into <title>, <meta> tags, Open Graph tags, etc. in the <head>
// for every page that doesn't override it.
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

// Without this, mobile browsers default to a ~980px desktop-width virtual
// viewport and scale the whole page down — every mobile breakpoint (sm:/md:)
// silently never applies. This is what actually makes the site responsive.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import WhatsAppButton from "@/components/WhatsAppButton";
import ChatWidget from "@/components/ChatWidget";
import { DEFAULT_CURRENCY } from "@/lib/currency";

// RootLayout receives `children`, which is whatever page/nested layout is
// currently being rendered. Every route in the app renders inside this shell.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the currency + market cookies set by middleware.ts (geo-detected or
  // manually picked) server-side, so Providers starts with the right values
  // on first paint instead of flashing the default then correcting itself.
  const initialCurrency = cookies().get("nc_currency")?.value ?? DEFAULT_CURRENCY;
  const initialMarket = cookies().get("nc_market")?.value ?? "FOREIGN";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme class before paint to avoid a light/dark flash.
            This runs as a plain inline script (not React) because it must
            execute before the page paints — reading localStorage/matchMedia
            here and toggling the "dark" class keeps the very first frame
            consistent with the user's saved/OS theme preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Providers supplies theme + currency + auth session context to every page */}
        <Providers initialCurrency={initialCurrency} initialMarket={initialMarket}>
          {children}
        </Providers>
        {/* These two floating buttons appear on every page, always on top */}
        <ChatWidget />
        <WhatsAppButton />
      </body>
    </html>
  );
}
