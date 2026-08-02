// Admin page — Reviews.
// Two tabs: "Internal Reviews" (guest reviews submitted on this site, with
// search/filter, a detail panel, and delete) and "Google Reviews" (an
// embedded live widget pulling reviews from the property's Google Business
// Profile). Internal review data comes from getReviewsData().
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Star, Trash2, Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { getReviewsData } from '@/lib/admin-actions';
import GoogleReviewsWidget from '@/components/GoogleReviewsWidget';

type ReviewRating = 1 | 2 | 3 | 4 | 5;

// Shape of an internal (site-submitted) review.
interface Review {
  id: string;
  guestName: string;
  rating: ReviewRating;
  comment: string;
  room: string;
  createdAt: string;
}

// Small reusable helper component: renders a row of 5 stars, filling in the
// ones up to `rating` and leaving the rest gray/outlined.
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= rating ? 'fill-accent text-accent' : 'text-gray-300'} />
      ))}
    </div>
  );
}

// Main page component — rendered at /admin/reviews.
export default function ReviewsPage() {
  const [activeTab, setActiveTab]       = useState<'internal' | 'google'>('internal');
  const [reviews, setReviews]           = useState<Review[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterRating, setFilterRating] = useState<'all' | ReviewRating>('all');
  // The review currently open in the detail panel (null = none selected).
  const [selected, setSelected]         = useState<Review | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [actionMsg, setActionMsg]       = useState('');

  // Loads all internal reviews from the server action.
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await getReviewsData();
    if (data) setReviews(data);
    else setError(true);
    setLoading(false);
  }, []);

  // Runs once on mount to load reviews.
  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Permanently deletes the selected review, after a confirm() prompt.
  async function handleDelete() {
    if (!selected) return;
    if (!confirm('Delete this review permanently?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setReviews(prev => prev.filter(r => r.id !== selected.id));
      setSelected(null);
      setActionMsg('Review deleted.');
    } catch {
      setActionMsg('Failed to delete review.');
    } finally {
      setDeleting(false);
    }
  }

  // Applies the search box and star-rating filter to the full review list.
  const filtered = reviews.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      r.guestName.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q) ||
      r.room.toLowerCase().includes(q);
    const matchFilter = filterRating === 'all' || r.rating === Number(filterRating);
    return matchSearch && matchFilter;
  });

  // Average star rating across all reviews, rounded to 1 decimal place
  // (shown as an em-dash if there are no reviews yet, to avoid dividing by zero).
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  // How many reviews exist at each star level (5 down to 1), used to draw
  // the rating distribution bars.
  const dist = [5, 4, 3, 2, 1].map(n => ({
    n,
    count: reviews.filter(r => r.rating === n).length,
  }));

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load reviews.</p>
      <button onClick={fetchReviews} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Reviews</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage guest reviews and ratings</p>
        </div>
        <button onClick={fetchReviews} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('internal')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'internal'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200'
          }`}
        >
          Internal Reviews
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'google'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Reviews
        </button>
      </div>

      {activeTab === 'google' && (
        <div className="glass-card hover-lift rounded-2xl p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Live reviews pulled from your Google Business Profile via Elfsight.</p>
          <GoogleReviewsWidget />
        </div>
      )}

      {activeTab === 'internal' && actionMsg && !selected && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      {activeTab === 'internal' && <>
      {/* Rating Summary */}
      {reviews.length > 0 && (
        <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">{avgRating}</div>
              <Stars rating={Math.round(parseFloat(avgRating))} size={20} />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              {dist.map(({ n, count }) => (
                <div key={n} className="flex items-center gap-2">
                  <Stars rating={n} size={12} />
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Search by guest, room, or content"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filterRating}
            onChange={e => setFilterRating(e.target.value === 'all' ? 'all' : Number(e.target.value) as ReviewRating)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Ratings</option>
            {[5, 4, 3, 2, 1].map(n => (
              <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 glass-card hover-lift rounded-2xl">
              <p className="text-gray-500 dark:text-gray-400">
                {reviews.length === 0
                  ? 'No reviews yet. Reviews submitted by guests will appear here.'
                  : 'No reviews match your search.'}
              </p>
            </div>
          ) : filtered.map(review => (
            <div
              key={review.id}
              onClick={() => { setSelected(review); setActionMsg(''); }}
              className={`glass-card hover-lift rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-shadow ${selected?.id === review.id ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{review.guestName}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{review.room}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mb-3">
                <Stars rating={review.rating} />
              </div>
              {review.comment && (
                <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2">{review.comment}</p>
              )}
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="glass-card hover-lift rounded-2xl p-6 sticky top-24">
            <div className="flex items-start justify-between mb-4 pb-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">{selected.guestName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selected.room}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <Stars rating={selected.rating} size={20} />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(selected.createdAt).toLocaleDateString()}</p>
            </div>

            {selected.comment && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                {selected.comment}
              </div>
            )}

            {actionMsg && (
              <p className="text-xs text-center text-gray-600 dark:text-gray-400 mb-3">{actionMsg}</p>
            )}

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete Review
            </button>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
