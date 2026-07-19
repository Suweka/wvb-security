// Global error boundary for the App Router.
// Next.js automatically renders this component whenever an error is thrown
// while rendering a page (anywhere under this app/ segment) that isn't
// caught by a more specific error.tsx. It replaces the crashed page's UI.
'use client';

import { useEffect } from 'react';

// Next.js passes this component two special props automatically:
// - error: the thrown Error object (with an optional `digest` id for server logs)
// - reset: a function that tries to re-render the segment that crashed
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // useEffect runs after the component renders. Here it runs once whenever
  // `error` changes, logging the crash to the browser console so it's easier
  // to debug (this does not get sent anywhere else, just console.error).
  useEffect(() => {
    console.error('Caught by global error.tsx:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50 text-red-900">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <div className="bg-white p-4 rounded shadow mb-4 max-w-2xl overflow-auto border border-red-200">
        <p className="font-mono text-sm">{error.message || 'Unknown error'}</p>
        {/* Only show the stack trace if the browser actually captured one */}
        {error.stack && (
          <pre className="mt-4 text-xs whitespace-pre-wrap text-left">
            {error.stack}
          </pre>
        )}
      </div>
      {/* Calling reset() tells Next.js to try rendering the page again
          without a full browser reload */}
      <button
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
