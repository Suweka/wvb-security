import { Providers } from '@/components/Providers'
import { Navbar } from '@/components/guest/Navbar'
import { Footer } from '@/components/guest/Footer'
import { BackToTop } from '@/components/guest/BackToTop'

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <BackToTop />
      </div>
    </Providers>
  )
}