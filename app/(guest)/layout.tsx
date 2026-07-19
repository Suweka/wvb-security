// This is the shared layout for every page inside the (guest) route group — i.e. all
// the public-facing pages like Home, About, Rooms, Contact, etc. Next.js automatically
// wraps each page's content with this layout. It's a Server Component (no 'use client'),
// so it renders on the server; the interactive bits (Navbar, Providers) are client
// components imported from elsewhere.
import { Providers } from '@/components/Providers'
import { Navbar } from '@/components/guest/Navbar'
import { Footer } from '@/components/guest/Footer'
import { BackToTop } from '@/components/guest/BackToTop'

// `children` is whatever the current page component renders (e.g. HomePage, AboutPage) —
// Next.js passes it in automatically based on which route the user is visiting.
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Providers wraps the app with any React Context providers it needs (e.g. auth session, theme)
    <Providers>
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