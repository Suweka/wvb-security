'use client';

import Script from 'next/script';

const ELFSIGHT_APP_ID = 'a172a998-98e0-4cba-8746-0b7088218bfb';

export default function GoogleReviewsWidget() {
  return (
    <>
      <Script
        src="https://elfsightcdn.com/platform.js"
        strategy="afterInteractive"
        async
      />
      <div
        className={`elfsight-app-${ELFSIGHT_APP_ID}`}
        data-elfsight-app-lazy
      />
    </>
  );
}
