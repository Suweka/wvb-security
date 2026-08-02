// This is the shared layout for every page inside the (guest) route group — i.e. all
// the public-facing pages like Home, About, Rooms, Contact, etc. Next.js automatically
// wraps each page's content with this layout. It's a Server Component (no 'use client'),
// so it renders on the server; the interactive bits (Navbar, Providers) are client
// components imported from elsewhere.
import { cookies } from 'next/headers'
import { Providers } from '@/components/Providers'
import { Navbar } from '@/components/guest/Navbar'
import { Footer } from '@/components/guest/Footer'
import { BackToTop } from '@/components/guest/BackToTop'
import { DEFAULT_CURRENCY } from '@/lib/currency'

// `children` is whatever the current page component renders (e.g. HomePage, AboutPage) —
// Next.js passes it in automatically based on which route the user is visiting.
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read the currency + market cookies set by middleware.ts (geo-detected or
  // manually picked), same as the root layout, so this nested Providers
  // starts with the right values too instead of flashing the defaults.
  const initialCurrency = cookies().get('nc_currency')?.value ?? DEFAULT_CURRENCY
  const initialMarket = cookies().get('nc_market')?.value ?? 'FOREIGN'

  return (
    // Providers wraps the app with any React Context providers it needs (e.g. auth session, theme)
    <Providers initialCurrency={initialCurrency} initialMarket={initialMarket}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        {/* The current page's content is rendered here, between the navbar and footer */}
        <main className="flex-1">{children}</main>
        <Footer />
        <BackToTop />
      </div>
    </Providers>
  )
}