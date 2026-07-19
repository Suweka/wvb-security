// Admin page — Audit Log.
// Shows a searchable, expandable list of "who did what and when" events
// (logins, room edits, receipt approvals, booking cancellations, etc.)
// pulled from the /api/admin/audit-log endpoint. Read-only page — it never
// writes data, it just displays what already happened.

// 'use client' tells Next.js this component runs in the browser (not on the
// server). It's required here because we use React state and hooks (useState,
// useEffect) which only work client-side.
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, AlertCircle, RefreshCw, ShieldCheck, ShieldAlert, ChevronDown } from 'lucide-react';

// Shape of a single audit log row as returned by the API.
interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Maps each audit action name to a Tailwind badge color so different event
// types are visually distinguishable at a glance in the list.
const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS:    'bg-green-100 text-green-700',
  LOGIN_FAILED:     'bg-red-100 text-red-700',
  ROOM_CREATE:      'bg-blue-100 text-blue-700',
  ROOM_UPDATE:      'bg-blue-100 text-blue-700',
  ROOM_DELETE:      'bg-red-100 text-red-700',
  RECEIPT_APPROVE:  'bg-green-100 text-green-700',
  RECEIPT_REJECT:   'bg-red-100 text-red-700',
  BOOKING_CANCEL:   'bg-yellow-100 text-yellow-700',
  BOOKING_EDIT:     'bg-blue-100 text-blue-700',
};

// Main page component — rendered at /admin/audit-log.
export default function AuditLogPage() {
  // React state hooks — each useState gives us a value plus a setter function.
  // Calling the setter schedules a re-render with the new value.
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Tracks which single entry's metadata panel is currently expanded (or null
  // if none are open) — only one row can be expanded at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetches the audit log from the API. Wrapped in useCallback so the same
  // function reference is reused across renders (avoids re-running the
  // effect below unnecessarily).
  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/audit-log');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // useEffect runs side effects (like data fetching) after the component
  // renders. This one runs once when the page first loads (and again only if
  // fetchLog itself changes, which it won't since it's memoized above).
  useEffect(() => { fetchLog(); }, [fetchLog]);

  // Client-side search filter — narrows the full entries list down to rows
  // whose actor, action, or entity type contains the typed search text.
  const filtered = entries.filter(e => {
    const q = searchQuery.toLowerCase();
    return (
      e.actor.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.entityType || '').toLowerCase().includes(q)
    );
  });

  // Count of failed login attempts, used to show a security warning banner.
  const failedLogins = entries.filter(e => e.action === 'LOGIN_FAILED').length;

  // Early return: while the fetch is in flight, show a spinner instead of
  // the page content below.
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  // Early return: if the fetch failed, show an error state with a retry button.
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load the audit log.</p>
      <button onClick={fetchLog} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2 flex items-center gap-2">
            <ShieldCheck className="text-primary" size={28} /> Audit Log
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Who did what, and when — most recent 200 events</p>
        </div>
        <button onClick={fetchLog} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {failedLogins > 0 && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          <ShieldAlert size={18} className="flex-shrink-0" />
          {failedLogins} failed login attempt{failedLogins > 1 ? 's' : ''} recorded — check the IPs below if any pattern looks like brute forcing.
        </div>
      )}

      <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by actor, action, or entity"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 glass-card hover-lift rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">{entries.length === 0 ? 'No audit events recorded yet.' : 'No events match your search.'}</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(entry => {
              // Whether this specific row is the one currently expanded.
              const isOpen = expandedId === entry.id;
              // Only rows with extra metadata (JSON details) are clickable/expandable.
              const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => hasMetadata && setExpandedId(isOpen ? null : entry.id)}
                    className={`w-full flex flex-wrap items-center gap-3 px-6 py-4 text-left ${hasMetadata ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : 'cursor-default'}`}
                  >
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-700'}`}>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.actor}</span>
                    {entry.entityType && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}</span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      {new Date(entry.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    {hasMetadata && (
                      <ChevronDown size={16} className={`text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {isOpen && hasMetadata && (
                    <pre className="px-6 pb-4 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
