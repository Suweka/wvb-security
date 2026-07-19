// This is the page shown when a guest's PayHere payment is cancelled during booking
// (e.g. they click "cancel" on the payment gateway, or the payment fails).
// It reads the booking reference from the URL query string and offers to retry
// payment or contact support. No API calls happen on this page — it's purely informational.

// 'use client' — this component runs in the browser because it needs useSearchParams()
// (reads the current URL's query string) which only works on the client.
'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, RotateCcw, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Inner component that actually reads the URL and renders the cancellation message.
// It's split out from the default-exported page so it can be wrapped in <Suspense>
// below (useSearchParams requires a Suspense boundary in Next.js App Router).
function CancelContent() {
  // useSearchParams() gives us access to the current URL's ?query=params.
  const searchParams = useSearchParams();
  // Pull the booking reference (e.g. ?ref=WVB-2026-XXXXXX) out of the URL, if present.
  const ref = searchParams.get('ref') || '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 flex items-center justify-center px-4 py-16">
      <div className="glass-strong rounded-2xl shadow-lg p-10 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="text-red-500" size={44} />
        </div>

        <h1 className="text-3xl font-heading font-bold mb-3">Payment Cancelled</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your payment was not completed. Your booking has been placed on hold — no charge was made.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-8 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Booking Reference</span>
            <span className="font-semibold">{ref}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className="font-semibold text-yellow-600">Payment Pending</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          You can retry payment or contact us to pay via bank transfer. Your booking reference is valid for 24 hours.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            size="lg"
            /* Send the guest back to the booking page, carrying the booking ref so they can retry payment */
            onClick={() => window.location.href = `/booking?ref=${ref}`}
          >
            <RotateCcw size={18} className="mr-2" />
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.location.href = '/contact'}>
            <Phone size={18} className="mr-2" />
            Contact Us
          </Button>
        </div>
      </div>
    </div>
  );
}

// The actual page component Next.js renders for this route. It wraps CancelContent
// in <Suspense> with a spinner fallback, which is required because CancelContent uses
// useSearchParams() — Next.js needs a Suspense boundary around any component that reads
// the URL this way so it can render a fallback while the page is still loading.
export default function BookingCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>}>
      <CancelContent />
    </Suspense>
  );
}
