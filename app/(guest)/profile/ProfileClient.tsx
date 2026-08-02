// This is the Client Component that renders the logged-in guest's profile page:
// a tabbed dashboard (Overview / My Bookings / Saved Payments / Loyalty / Edit Profile).
// It receives the guest's data as a prop from the server (see app/(guest)/profile/page.tsx,
// which fetches it from the database with Prisma) and handles all the interactive bits:
// switching tabs, editing profile fields, signing out, and submitting reviews.

// 'use client' — required because this component uses React state (useState) for the
// active tab, form fields, and modal, plus click handlers like signOut().
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Calendar,
  LogOut,
  Camera,
  CreditCard,
  Check,
  Award,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { calculateRefund } from '@/lib/refund-policy';

// Labels for the sidebar navigation tabs, used both to render the buttons and to
// compare against activeTab state to know which panel to show.
const TABS = ['Overview', 'My Bookings', 'Saved Payments', 'Loyalty', 'Edit Profile'];

// Styling and point-threshold info for each loyalty tier. `next` is the points needed
// to reach the *next* tier (null for PLATINUM, since it's the top tier).
const LOYALTY_TIERS = {
  BRONZE: { label: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-100', next: 500 },
  SILVER: { label: 'Silver', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', next: 1500 },
  GOLD: { label: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100', next: 3000 },
  PLATINUM: { label: 'Platinum', color: 'text-blue-600', bg: 'bg-blue-100', next: null },
};

// Formats a plain number as an "LKR 12,345.67"-style currency string for display.
function formatCurrency(amount: number) {
  return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Shape of a review the guest has already submitted (used to check alreadyReviewed()).
interface ExistingReview {
  id: string;
  roomId: string;
  rating: number;
  comment: string | null;
}

interface ProfileClientProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    country?: string | null;
    address?: string | null;
    avatarUrl?: string | null;
    loyaltyPoints: number;
    loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    preferredLanguage?: string | null;
    bookings: any[];
    savedPayments: any[];
    reviews?: ExistingReview[];
  };
}

// `user` is passed down from the server component (app/(guest)/profile/page.tsx),
// which already fetched it from the database — this component just displays and
// edits it, it doesn't fetch the initial data itself.
export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  // Which sidebar tab is currently selected/visible.
  const [activeTab, setActiveTab] = useState('Overview');
  // True while the "Edit Profile" form is being saved (disables the save button).
  const [saving, setSaving] = useState(false);

  // Cancel-booking modal state — the booking being cancelled (opens the
  // modal when non-null), the guest's optional reason, and request status.
  const [cancelBooking, setCancelBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError]     = useState('');

  // Review modal state
  // The booking currently being reviewed (opens the review modal when non-null).
  const [reviewBooking, setReviewBooking]     = useState<any | null>(null);
  // The star rating (1-5) the guest has selected in the review modal.
  const [reviewRating, setReviewRating]       = useState(0);
  // Which star is currently hovered, used to preview the rating before clicking.
  const [reviewHover, setReviewHover]         = useState(0);
  // The free-text comment typed into the review modal.
  const [reviewComment, setReviewComment]     = useState('');
  // True while the review is being submitted to the API.
  const [reviewLoading, setReviewLoading]     = useState(false);
  const [reviewError, setReviewError]         = useState('');
  // Room IDs the guest has reviewed *during this session* (before the page data
  // refreshes), so the "Leave a Review" button can hide immediately after submitting.
  const [submittedRooms, setSubmittedRooms]   = useState<string[]>([]);

  // True if the guest has already reviewed this room, either from data loaded on page
  // load (user.reviews) or from a review they just submitted this session (submittedRooms).
  const alreadyReviewed = (roomId: string) =>
    (user.reviews || []).some(r => r.roomId === roomId) || submittedRooms.includes(roomId);

  // True if the booking's check-out date has already passed — only past, completed
  // stays are eligible for a review.
  const isPastStay = (checkOut: string) => new Date(checkOut) < new Date();

  // Submits the guest's star rating + comment for the selected booking's room to the
  // /api/reviews endpoint, then closes the modal and marks the room as reviewed.
  async function handleSubmitReview() {
    if (!reviewBooking || reviewRating === 0) return;
    setReviewLoading(true);
    setReviewError('');
    try {
      const res = await fetch('/api/reviews', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating:    reviewRating,
          comment:   reviewComment.trim() || null,
          roomId:    reviewBooking.room.id,
          bookingId: reviewBooking.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setReviewError(data.error || 'Failed to submit review.');
        return;
      }
      setSubmittedRooms(prev => [...prev, reviewBooking.room.id]);
      setReviewBooking(null);
      setReviewRating(0);
      setReviewComment('');
    } catch {
      setReviewError('Something went wrong. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  }

  // Cancels the reservation via the self-service API. On success the server
  // has already filed a refund request if the booking was paid — refresh the
  // server-rendered profile data so statuses/badges update immediately.
  async function handleCancelBooking() {
    if (!cancelBooking) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingNumber: cancelBooking.bookingNumber,
          reason: cancelReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || 'Failed to cancel the booking.');
        return;
      }
      setCancelBooking(null);
      setCancelReason('');
      router.refresh();
    } catch {
      setCancelError('Something went wrong. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  }

  // Editable copy of the profile fields, pre-filled from the user prop. Kept separate
  // from `user` itself so edits don't mutate the original prop directly.
  const [profileForm, setProfileForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    country: user.country || '',
    address: user.address || '',
    preferredLanguage: user.preferredLanguage || 'en',
  });

  // Look up the display label/color/next-threshold for the guest's current loyalty tier.
  const tier = LOYALTY_TIERS[user.loyaltyTier];

  // Sends the edited profile fields to the /api/profile endpoint (PATCH = partial update).
  const handleProfileSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (response.ok) {
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass-card hover-lift rounded-2xl p-6 text-center mb-4">
              {/* Avatar */}
              <div className="relative inline-block mb-4">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || ''}
                    className="w-24 h-24 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mx-auto">
                    <span className="text-3xl text-white font-bold">
                      {user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full flex items-center justify-center shadow">
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="font-bold text-lg">{user.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{user.email}</p>

              {/* Loyalty Badge */}
              <div className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${tier.bg} ${tier.color}`}>
                <Star size={14} />
                {tier.label} Member
              </div>

              {/* Points */}
              <div className="mt-4 p-3 bg-light-green rounded-lg">
                <div className="text-2xl font-bold text-primary">{user.loyaltyPoints}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Loyalty Points</div>
                {tier.next && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {tier.next - user.loyaltyPoints} pts to next tier
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="glass-card hover-lift rounded-2xl overflow-hidden">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition border-l-4 ${
                    activeTab === tab
                      ? 'border-primary bg-light-green text-primary'
                      : 'border-transparent hover:bg-white/60 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
              {/* signOut() comes from next-auth; callbackUrl tells it to redirect to
                  the homepage after the session is cleared */}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 border-l-4 border-transparent"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">

            {/* Overview Tab */}
            {activeTab === 'Overview' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Total Stays', value: user.bookings.length, icon: Calendar },
                    { label: 'Loyalty Points', value: user.loyaltyPoints, icon: Star },
                    { label: 'Reviews', value: user.reviews?.length || 0, icon: Award },
                  ].map((stat) => (
                    <div key={stat.label} className="glass-card hover-lift rounded-2xl p-6 text-center">
                      <stat.icon size={32} className="mx-auto text-primary mb-2" />
                      <div className="text-3xl font-bold text-primary">{stat.value}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Bookings */}
                <div className="glass-card hover-lift rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4">Recent Bookings</h3>
                  {user.bookings.slice(0, 3).length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No bookings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {user.bookings.slice(0, 3).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition">
                          <div>
                            <p className="font-medium">{booking.room?.name || 'Room'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{formatCurrency(Number(booking.totalAmount))}</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                              booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* My Bookings Tab */}
            {activeTab === 'My Bookings' && (
              <div className="glass-card hover-lift rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-4">All Bookings</h3>
                {user.bookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't made any bookings yet</p>
                    <a href="/booking" className="inline-block bg-primary text-white px-6 py-3 rounded-lg hover:opacity-90 transition">
                      Book Now
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {user.bookings.map((booking: any) => {
                      // Bank-transfer bookings need a manually uploaded receipt that an
                      // admin verifies, unlike card/online payments which confirm instantly.
                      const isBankTransfer  = booking.paymentMethod === 'bank';
                      const receiptStatus   = booking.bankTransferReceipt?.status;
                      const receiptUploaded = !!booking.bankTransferReceipt;
                      return (
                      <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition">
                        <div className="flex justify-between items-start flex-wrap gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-lg">{booking.room?.name || 'Room'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Ref: <span className="font-mono text-primary">{booking.bookingNumber}</span></p>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
                              <span>Check-in: <strong>{new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                              <span>Check-out: <strong>{new Date(booking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                              <span>{booking.guests} guest{booking.guests > 1 ? 's' : ''}</span>
                            </div>
                            {/* Payment badges */}
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                                {booking.paymentMethod === 'bank' ? 'Bank Transfer'
                                  : booking.paymentMethod === 'card' ? 'Credit/Debit Card'
                                  : booking.paymentMethod === 'helapay' ? 'HelaPay'
                                  : booking.paymentMethod === 'webxpay' ? 'WebXPay'
                                  : booking.paymentMethod || 'Online'}
                              </span>
                              <span className={`px-2 py-1 rounded-full font-medium ${
                                booking.paymentStatus === 'PAID'    ? 'bg-green-100 text-green-700' :
                                booking.paymentStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'}`}>
                                Payment: {booking.paymentStatus === 'PAID' ? 'Paid' : booking.paymentStatus === 'PENDING' ? 'Pending' : 'Failed'}
                              </span>
                              {isBankTransfer && receiptUploaded && (
                                <span className={`px-2 py-1 rounded-full font-medium ${
                                  receiptStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                  receiptStatus === 'PENDING'  ? 'bg-orange-100 text-orange-700' :
                                  'bg-red-100 text-red-700'}`}>
                                  Receipt: {receiptStatus === 'APPROVED' ? 'Approved' : receiptStatus === 'PENDING' ? 'Under Review' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-primary text-lg">{formatCurrency(Number(booking.totalAmount))}</p>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              booking.status === 'CONFIRMED'  ? 'bg-green-100 text-green-700' :
                              booking.status === 'PENDING'    ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'}`}>
                              {booking.status === 'CONFIRMED' ? 'Confirmed' : booking.status === 'PENDING' ? 'Pending' : 'Cancelled'}
                            </span>
                          </div>
                        </div>

                        {/* Action row */}
                        <div className="mt-3 pt-3 border-t flex items-center justify-between flex-wrap gap-2">
                          {/* Bank transfer receipt actions */}
                          {isBankTransfer && booking.status === 'PENDING' && (
                            !receiptUploaded ? (
                              <a href={`/booking/upload-receipt?ref=${booking.bookingNumber}`}
                                 className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition font-medium">
                                Upload Payment Receipt
                              </a>
                            ) : receiptStatus === 'PENDING' ? (
                              <p className="text-sm text-orange-600 font-medium">Receipt submitted — awaiting admin verification</p>
                            ) : receiptStatus === 'REJECTED' ? (
                              <div className="flex items-center gap-3">
                                <p className="text-sm text-red-600">Receipt rejected. Please re-upload.</p>
                                <a href={`/booking/upload-receipt?ref=${booking.bookingNumber}`}
                                   className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 transition">
                                  Re-upload
                                </a>
                              </div>
                            ) : null
                          )}

                          {/* Review action — only for past confirmed stays. Shows a
                              "Reviewed" badge if already reviewed, otherwise a button
                              that opens the review modal (sets reviewBooking) */}
                          {booking.status === 'CONFIRMED' && isPastStay(booking.checkOut) && (
                            alreadyReviewed(booking.room?.id) ? (
                              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                <Star size={14} className="fill-green-500 text-green-500" />
                                Reviewed
                              </span>
                            ) : (
                              <button
                                onClick={() => { setReviewBooking(booking); setReviewRating(0); setReviewComment(''); setReviewError(''); }}
                                className="flex items-center gap-1.5 text-sm text-primary border border-primary px-3 py-1.5 rounded-lg hover:bg-primary-light transition font-medium"
                              >
                                <Star size={14} />
                                Leave a Review
                              </button>
                            )
                          )}

                          {/* Cancel action — upcoming, not-yet-cancelled stays only.
                              Multi-room reservations show it only on the primary row
                              (no "-R" suffix), since cancelling covers all rooms. */}
                          {booking.status !== 'CANCELLED' && !isPastStay(booking.checkOut) && !/-R\d+$/.test(booking.bookingNumber) && (
                            <button
                              onClick={() => { setCancelBooking(booking); setCancelReason(''); setCancelError(''); }}
                              className="flex items-center gap-1.5 text-sm text-red-600 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-medium"
                            >
                              <X size={14} />
                              Cancel Booking
                            </button>
                          )}

                          {/* Refund request status — shown once a cancellation has
                              filed a refund request for this (primary) booking. */}
                          {booking.refundRequest && (
                            booking.refundRequest.status === 'PENDING' ? (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-orange-100 text-orange-700">
                                Refund requested — {formatCurrency(Number(booking.refundRequest.amount))} pending review
                              </span>
                            ) : booking.refundRequest.status === 'APPROVED' ? (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                                Refund approved — {formatCurrency(Number(booking.refundRequest.amount))}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700" title={booking.refundRequest.adminNote || undefined}>
                                Refund declined{booking.refundRequest.adminNote ? ` — ${booking.refundRequest.adminNote}` : ''}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}

            {/* Saved Payments Tab */}
            {activeTab === 'Saved Payments' && (
              <div className="glass-card hover-lift rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Saved Payment Methods</h3>
                  <button className="text-sm text-primary hover:underline font-medium">+ Add New</button>
                </div>

                {user.savedPayments.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <CreditCard size={48} className="mx-auto mb-4" />
                    <p className="mb-2">No saved payment methods</p>
                    <p className="text-sm">Add a payment method for faster checkout</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {user.savedPayments.map((pm: any) => (
                      <div key={pm.id} className="flex items-center justify-between p-4 border rounded-xl hover:shadow-md transition">
                        <div className="flex items-center gap-3">
                          <CreditCard size={22} className="text-primary" />
                          <div>
                            <p className="font-medium">{pm.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{pm.type}</p>
                          </div>
                          {pm.isDefault && (
                            <span className="text-xs bg-light-green text-primary px-2 py-0.5 rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        <button className="text-xs text-red-500 hover:underline">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Loyalty Tab */}
            {activeTab === 'Loyalty' && (
              <div className="glass-card hover-lift rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-6">Loyalty Rewards</h3>

                {/* Tier progress */}
                <div className="relative flex justify-between mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map(t => (
                    <span key={t} className={user.loyaltyTier === t ? 'text-primary font-bold' : ''}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min((user.loyaltyPoints / 3000) * 100, 100)}%`
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-light-green p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-primary">{user.loyaltyPoints}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Points</div>
                  </div>
                  <div className="bg-accent/20 p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-yellow-700">
                      {user.loyaltyTier}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Current Tier</div>
                  </div>
                </div>

                <div className="border rounded-xl p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Star size={20} className="text-primary" />
                    How to Earn Points
                  </h4>
                  <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">🛏</span>
                      <span>Each night booked = <strong className="text-primary">50 points</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">⭐</span>
                      <span>Leave a review = <strong className="text-primary">25 points</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">🎉</span>
                      <span>Complete your profile = <strong className="text-primary">50 points</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-2xl">📧</span>
                      <span>Refer a friend = <strong className="text-primary">200 points</strong></span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Edit Profile Tab */}
            {activeTab === 'Edit Profile' && (
              <div className="glass-card hover-lift rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-6">Edit Profile</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                    <select
                      value={profileForm.country}
                      onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select Country</option>
                      <option value="LK">Sri Lanka</option>
                      <option value="US">United States</option>
                      <option value="UK">United Kingdom</option>
                      <option value="IN">India</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
                      <textarea
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        rows={3}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleProfileSave}
                    disabled={saving}
                    className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={20} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-heading font-bold">Leave a Review</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{reviewBooking.room?.name}</p>
              </div>
              <button onClick={() => setReviewBooking(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Star picker */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Rating *</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onMouseEnter={() => setReviewHover(n)}
                      onMouseLeave={() => setReviewHover(0)}
                      onClick={() => setReviewRating(n)}
                      className="focus:outline-none"
                    >
                      <Star
                        size={32}
                        className={
                          n <= (reviewHover || reviewRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }
                      />
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Review</label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your stay..."
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                />
              </div>

              {reviewError && (
                <p className="text-sm text-red-600">{reviewError}</p>
              )}

              <div className="bg-primary-light rounded-lg px-4 py-2.5 text-sm text-primary font-medium flex items-center gap-2">
                <Star size={14} className="fill-primary text-primary" />
                You'll earn <strong>25 loyalty points</strong> for this review!
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setReviewBooking(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewLoading || reviewRating === 0}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                {reviewLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Modal — previews the policy-computed refund outcome
          before the guest confirms, using the same calculateRefund logic the
          server applies (lib/refund-policy.ts is a pure shared function). */}
      {cancelBooking && (() => {
        const isPaid = cancelBooking.paymentStatus === 'PAID';
        const refund = isPaid
          ? calculateRefund({
              totalAmount: Number(cancelBooking.totalAmount),
              checkIn: new Date(cancelBooking.checkIn),
              checkOut: new Date(cancelBooking.checkOut),
              cancelledAt: new Date(),
            })
          : null;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-heading font-bold">Cancel Booking</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {cancelBooking.room?.name} &middot; {cancelBooking.bookingNumber}
                  </p>
                </div>
                <button onClick={() => setCancelBooking(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Policy-outcome preview */}
                {!isPaid ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No payment has been made for this booking yet, so there is nothing to refund.
                  </p>
                ) : refund?.rule === 'FULL' ? (
                  <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-sm text-green-800">
                    You'll receive a <strong>full refund of {formatCurrency(refund.amount)}</strong> (cancelled more
                    than 24 hours before check-in). A refund request will be sent to our team automatically.
                  </div>
                ) : refund?.rule === 'PARTIAL' ? (
                  <div className="bg-orange-50 border border-orange-300 rounded-lg px-4 py-3 text-sm text-orange-800">
                    A <strong>one-night charge applies</strong> (cancellation within 24 hours of check-in, per our{' '}
                    <a href="/refund-policy" target="_blank" className="underline">refund policy</a>). You'll be
                    refunded <strong>{formatCurrency(refund.amount)}</strong>. A refund request will be sent to our
                    team automatically.
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Per our <a href="/refund-policy" target="_blank" className="underline">refund policy</a>, this
                      cancellation is <strong>not eligible for a refund</strong> (at or after check-in). You can still
                      cancel, and contact us if you believe an exception applies.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us why you're cancelling..."
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                  />
                </div>

                {cancelError && (
                  <p className="text-sm text-red-600">{cancelError}</p>
                )}
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setCancelBooking(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelBooking}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}