// Embeds a third-party "Elfsight" widget that displays Google Reviews.
// Elfsight is a no-code widget platform: we just need to load their script
// and drop a specially-named <div> on the page; their script finds it and
// fills it in with the reviews widget at runtime.
'use client';

import Script from 'next/script';

// This ID identifies which Elfsight widget (configured on their dashboard) to load.
const ELFSIGHT_APP_ID = 'a172a998-98e0-4cba-8746-0b7088218bfb';

export default function GoogleReviewsWidget() {
  return (
    <>
      {/* next/script optimizes how/when third-party scripts load.
          strategy="afterInteractive" loads it after the page becomes interactive,
          so it doesn't block the initial page render. */}
      <Script
        src="https://elfsightcdn.com/platform.js"
        strategy="afterInteractive"
        async
      />
      {/* Elfsight's script scans the page for an element whose class name
          matches "elfsight-app-<APP_ID>" and injects the reviews widget into it. */}
      <div
        className={`elfsight-app-${ELFSIGHT_APP_ID}`}
        data-elfsight-app-lazy
      />
    </>
  );
}
