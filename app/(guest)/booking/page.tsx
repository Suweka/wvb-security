// ─────────────────────────────────────────────────────────────────────────
// PAGE: /booking
//
// This is the multi-step guest booking flow: pick room(s) + dates → enter
// guest details → choose a payment method → see a confirmation screen.
// All four "steps" live in ONE component and are shown/hidden based on a
// `currentStep` piece of state, rather than being separate pages/routes —
// that's what makes the animated step-to-step transitions possible.
// ─────────────────────────────────────────────────────────────────────────

// 'use client' tells Next.js this component (and everything it renders)
// runs in the browser, not on the server. It's required here because the
// page uses React state, effects, browser-only APIs (like reading the URL
// query string), and animation.
'use client';

import React, { useState, useEffect, Suspense } from 'react';
// Reads query-string parameters from the current URL, e.g. ?room=xyz&checkIn=2026-08-01
import { useSearchParams } from 'next/navigation';
// framer-motion: animation library. `motion.div` etc. are drop-in replacements
// for normal HTML elements that can animate their properties (position, scale,
// opacity...). `AnimatePresence` lets elements animate OUT when they're removed
// from the tree (normally React just deletes them instantly).
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { CountUp } from '@/components/guest/CountUp';
import { Magnetic } from '@/components/ui/Magnetic';
// Icon components from the lucide-react icon library — each is just a small SVG.
import {
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Tag,
  Loader2,
  ExternalLink,
  Minus,
  Plus,
  Upload,
  Clock,
  Smartphone,
  Globe,
  Landmark,
} from 'lucide-react';

// A union type — `currentStep` can only ever be one of these four exact
// strings. TypeScript will flag it as an error if we try to set it to
// anything else, which helps prevent typos like 'detials'.
type BookingStep = 'dates' | 'details' | 'payment' | 'confirmation';

// Shape of a room as returned by GET /api/rooms — a simplified view of the
// full database Room record, with just what this page needs to display.
interface RoomOption {
  id: string;
  name: string;
  price: number;
  maxGuests: number;
  image: string | null;
}

// Converts a "YYYY-MM-DD" string (as it appears in the URL) into a JS Date
// set to local midnight. Appending 'T00:00:00' (instead of using `new
// Date(dateStr)` directly) forces the browser to parse it in the LOCAL
// timezone rather than UTC — without this, dates can shift by a day
// depending on the user's timezone.
function parseLocalDate(dateStr: string): Date | null {
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

// The actual page content. Split out from the default-exported component
// below so it can be wrapped in <Suspense> — useSearchParams() requires a
// Suspense boundary somewhere above it in Next.js's App Router.
function BookingPageContent() {
  const searchParams = useSearchParams();

  // All the rooms available to book, loaded from the API below.
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Which room IDs are currently selected. Initialised once (via the
  // function passed to useState, which only runs on the very first render)
  // from a `?room=` query param if the guest arrived via a "Book Now" link
  // on a specific room's page.
  const [selectedRooms, setSelectedRooms] = useState<string[]>(() => {
    const p = searchParams.get('room');
    return p ? [p] : [];
  });

  // Load real rooms from the DB, then make sure the selection (from the URL or default) is valid.
  // useEffect with an empty dependency array (`[]`) runs exactly once,
  // right after the component first renders — the standard pattern for
  // "fetch data on mount".
  useEffect(() => {
    // `cancelled` guards against a "setState after unmount" warning/bug:
    // if the component is removed from the page before the fetch finishes,
    // we skip updating state.
    let cancelled = false;
    fetch('/api/rooms')
      .then(r => r.json())
      .then((data: RoomOption[]) => {
        if (cancelled) return;
        setRooms(data);
        // Re-validate the selection against the rooms that actually exist
        // (e.g. the `?room=` param might reference a room that's been
        // deleted). Falls back to the first available room if nothing
        // valid is selected.
        setSelectedRooms(prev => {
          const valid = prev.filter(id => data.some(r => r.id === id));
          if (valid.length > 0) return valid;
          return data[0] ? [data[0].id] : [];
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRoomsLoading(false); });
    // Cleanup function — runs if the component unmounts before the fetch
    // resolves, flipping `cancelled` to true so the .then() above bails out.
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check-in/out dates, also pre-filled from the URL if present.
  const [checkInDate, setCheckInDate] = useState<Date | null>(() => {
    const p = searchParams.get('checkIn');
    return p ? parseLocalDate(p) : null;
  });

  const [checkOutDate, setCheckOutDate] = useState<Date | null>(() => {
    const p = searchParams.get('checkOut');
    return p ? parseLocalDate(p) : null;
  });

  // Number of guests, defaulting to 2 (or whatever the URL specifies).
  const [guests, setGuests] = useState<number>(() => {
    const p = searchParams.get('guests');
    return p ? (parseInt(p) || 2) : 2;
  });

  // Which month the calendar is currently displaying. Defaults to the
  // check-in month if one was passed in the URL, otherwise the real
  // current month.
  const [currentMonth, setCurrentMonth] = useState(() => {
    const p = searchParams.get('checkIn');
    if (p) {
      const d = parseLocalDate(p);
      if (d) return new Date(d.getFullYear(), d.getMonth());
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth());
  });

  // Which of the 4 steps (dates/details/payment/confirmation) is showing.
  const [currentStep, setCurrentStep] = useState<BookingStep>('dates');

  // All the text fields from the "Guest Details" step, grouped into one
  // object so a single handler (handleGuestDetailsChange, below) can
  // update any of them.
  const [guestDetails, setGuestDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    specialRequests: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'helapay' | 'webxpay' | 'bank'>('card');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Coupon code state: the raw text input, a loading flag while validating
  // against the server, any error message, and the successfully-applied
  // coupon (null until one passes validation).
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);

  // State for the final "Confirm Booking" submission.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingReference, setBookingReference] = useState('');

  // A Set of "YYYY-MM-DD" strings representing dates the selected room(s)
  // are already booked on — used to grey out/disable those calendar cells.
  // A Set is used instead of an array for fast `.has()` lookups.
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Returns a YYYY-MM-DD key from a local Date (avoids UTC shift)
  // Used both to build the `unavailableDates` Set and to check membership
  // in it, so the two always use the exact same date format.
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // True if any date strictly between `from` and `to` (exclusive) is unavailable
  // Used when the guest clicks a check-out date, to make sure the whole
  // range they're selecting doesn't pass through an already-booked night.
  const rangeHasUnavailable = (from: Date, to: Date) => {
    const cur = new Date(from);
    cur.setDate(cur.getDate() + 1);
    while (cur < to) {
      if (unavailableDates.has(toKey(cur))) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  };

  // Derived values (recomputed on every render — cheap enough not to need
  // memoisation here) describing the currently-selected rooms as a group.
  const selectedRoomObjects = rooms.filter(r => selectedRooms.includes(r.id));
  const totalMaxGuests = selectedRoomObjects.reduce((sum, r) => sum + r.maxGuests, 0) || 1;
  const totalNightlyRate = selectedRoomObjects.reduce((sum, r) => sum + r.price, 0);

  // Adds/removes a room from the selection when its card is clicked.
  // Also clamps the guest count down if removing a room drops the combined
  // max-guests capacity below the currently chosen guest count.
  const handleRoomToggle = (roomId: string) => {
    const isSelected = selectedRooms.includes(roomId);
    // Don't allow deselecting the very last room — at least one must stay selected.
    if (isSelected && selectedRooms.length === 1) return;
    const newSelected = isSelected
      ? selectedRooms.filter(id => id !== roomId)
      : [...selectedRooms, roomId];
    const newMax = rooms.filter(r => newSelected.includes(r.id)).reduce((sum, r) => sum + r.maxGuests, 0);
    setSelectedRooms(newSelected);
    if (guests > newMax) setGuests(newMax);
  };

  // Computes the full price breakdown (nights, subtotal, discount, tax,
  // final total) from the current dates/rooms/coupon. Called fresh on
  // every render rather than being stored in state, since it's cheap to
  // derive and this keeps it always in sync with its inputs.
  const calculateTotal = () => {
    if (!checkInDate || !checkOutDate) return { nights: 0, subtotal: 0, discount: 0, tax: 0, total: 0 };
    // Math.ceil rounds up to whole nights even if there's a partial-day difference.
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const subtotal = nights * totalNightlyRate;
    const discount = appliedCoupon ? (subtotal * appliedCoupon.discountPercent) / 100 : 0;
    const tax = (subtotal - discount) * 0.1; // flat 10% tax on the discounted subtotal
    return { nights, subtotal, discount, tax, total: subtotal - discount + tax };
  };

  // Sends the entered coupon code to the server for validation. The server
  // is the source of truth for whether a coupon is active/valid — we never
  // trust a discount percentage that wasn't confirmed by the API.
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || 'Invalid coupon code');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({ code: data.code, discountPercent: data.discountPercent });
        setCouponError('');
      }
    } catch {
      setCouponError('Failed to validate coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  // Computed once per render and reused throughout the JSX below (avoids
  // calling calculateTotal() repeatedly in the summary sidebar).
  const totals = calculateTotal();

  // Builds the array of calendar cells for a given month: `null` for the
  // leading blank cells (so day 1 lines up under the correct weekday
  // column) followed by one Date per day of the month.
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    // Day 0 of the *next* month is a JS trick for "the last day of THIS month".
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const days = getDaysInMonth(currentMonth);

  // Handles clicking a calendar day. Implements "click twice to pick a
  // range" behaviour: the first click sets check-in, the second sets
  // check-out (as long as it's after check-in and doesn't cross a booked
  // date) — otherwise it restarts the selection from the clicked date.
  const handleDateClick = (date: Date) => {
    if (unavailableDates.has(toKey(date))) return; // booked — ignore click

    if (!checkInDate || (checkInDate && checkOutDate)) {
      // No selection yet, OR a full range is already selected — start over.
      setCheckInDate(date);
      setCheckOutDate(null);
    } else if (checkInDate && !checkOutDate) {
      // Check-in is set, waiting for check-out.
      if (date > checkInDate) {
        if (rangeHasUnavailable(checkInDate, date)) {
          // Range crosses a booked date — restart from clicked date
          setCheckInDate(date);
          setCheckOutDate(null);
        } else {
          setCheckOutDate(date);
        }
      } else {
        // Clicked a date before the current check-in — treat it as a new check-in.
        setCheckInDate(date);
        setCheckOutDate(null);
      }
    }
  };

  // Whether a given calendar cell is exactly the check-in or check-out date (for highlighting).
  const isDateSelected = (date: Date | null) => {
    if (!date) return false;
    return (checkInDate?.getTime() === date.getTime()) || (checkOutDate?.getTime() === date.getTime());
  };

  // Whether a given cell falls strictly between check-in and check-out (for the "in range" highlight).
  const isDateInRange = (date: Date | null) => {
    if (!date || !checkInDate || !checkOutDate) return false;
    return date > checkInDate && date < checkOutDate;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch unavailable dates whenever the room selection changes
  // This effect re-runs any time the selected room IDs change (see the
  // dependency array below), asking the server which dates are already
  // booked for that combination of rooms.
  useEffect(() => {
    let cancelled = false;
    setAvailabilityLoading(true);
    fetch('/api/rooms/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomSlugs: selectedRooms }),
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setUnavailableDates(new Set<string>(data.unavailableDates || []));
          setAvailabilityLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
    // `selectedRooms.join(',')` is used instead of `selectedRooms` directly
    // because arrays are compared by reference in React's dependency
    // check — a new array with the same contents would still be treated as
    // "changed" and cause an infinite loop. Joining to a string sidesteps that.
  }, [selectedRooms.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selected dates when they fall inside newly unavailable ranges
  // Runs whenever the availability data changes (e.g. after switching
  // rooms) — if the guest's currently-picked check-in/out dates turn out
  // to be blocked for the new room selection, this clears them so they
  // don't submit a booking for an unavailable date.
  useEffect(() => {
    if (checkInDate && unavailableDates.has(toKey(checkInDate))) {
      setCheckInDate(null);
      setCheckOutDate(null);
      return;
    }
    if (checkInDate && checkOutDate && rangeHasUnavailable(checkInDate, checkOutDate)) {
      setCheckOutDate(null);
    }
  }, [unavailableDates]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  // Generic change handler for all the guest-details form fields. Uses the
  // input's `name` attribute as the key to update in the guestDetails
  // object, so one function handles every field instead of writing a
  // separate handler per input.
  const handleGuestDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setGuestDetails({ ...guestDetails, [e.target.name]: e.target.value });
  };

  // Gate conditions used to enable/disable the "Continue" buttons between steps.
  const canProceedToDetails = checkInDate && checkOutDate && selectedRooms.length > 0;
  const canProceedToPayment = guestDetails.firstName && guestDetails.lastName && guestDetails.email && guestDetails.phone;

  // Runs when the guest clicks "Confirm Booking" on the payment step.
  // Two-stage flow:
  //   1. Always create the booking record first (via /api/bookings).
  //   2. Then either show the confirmation screen directly (bank transfer,
  //      which needs manual verification) or redirect to PayHere's hosted
  //      checkout page (online card/wallet payments).
  const handleSubmit = async () => {
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setSubmitError('Please select a valid check-in and check-out date (minimum 1 night).');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      // Step 1 — persist the booking
      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rooms: selectedRooms,
          checkIn: checkInDate ? toKey(checkInDate) : null,
          checkOut: checkOutDate ? toKey(checkOutDate) : null,
          guests,
          guestDetails,
          paymentMethod,
          couponCode: appliedCoupon?.code || null,
          totalAmount: totals.total,
        }),
      });
      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        setSubmitError(bookingData.error || 'Failed to create booking. Please try again.');
        return;
      }

      const bookingNumber: string = bookingData.bookingNumber;
      setBookingReference(bookingNumber);

      // Step 2 — bank transfer: show confirmation screen directly
      // Bank transfers can't be verified automatically, so there's no
      // payment gateway redirect — the booking sits as "pending" until an
      // admin confirms the receipt the guest uploads afterwards.
      if (paymentMethod === 'bank') {
        setCurrentStep('confirmation');
        return;
      }

      // Step 3 — online payment: get PayHere form fields and redirect
      // Ask our own backend to generate the signed fields PayHere's hosted
      // checkout page requires (amount, hash, merchant ID, etc — see
      // app/api/payments/payhere/checkout/route.ts).
      const payRes = await fetch('/api/payments/payhere/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingNumber }),
      });
      const payData = await payRes.json();

      if (!payRes.ok) {
        // PayHere not configured yet — fall back to confirmation with a notice
        if (payRes.status === 503) {
          setSubmitError('Payment gateway not configured. Your booking is saved — please contact us to complete payment.');
          setCurrentStep('confirmation');
          return;
        }
        setSubmitError(payData.error || 'Payment initiation failed. Please try again.');
        return;
      }

      // Auto-submit a hidden form to PayHere's hosted checkout page
      // PayHere expects a classic HTML form POST (not a fetch/JSON request)
      // with all its required fields, so we build one in memory, fill it
      // with hidden inputs from the fields the API gave us, attach it to
      // the page, and immediately submit it — this navigates the browser
      // away to PayHere's payment page.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payData.checkoutUrl;
      Object.entries(payData.fields as Record<string, string>).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();

    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Metadata for the 4-step progress indicator rendered at the top of the page.
  const steps = [
    { id: 'dates', label: 'Select Dates', icon: '1' },
    { id: 'details', label: 'Guest Details', icon: '2' },
    { id: 'payment', label: 'Payment', icon: '3' },
    { id: 'confirmation', label: 'Confirmation', icon: '4' },
  ];

  // Index of the current step within `steps` — used to figure out which
  // steps before it should show as "done" (checkmark + filled connector line).
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 py-12 px-4 relative overflow-hidden">
      {/* Ambient glass blobs — purely decorative background shapes, positioned fixed so they don't scroll with the content */}
      <div className="fixed top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[28rem] h-[28rem] bg-accent/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />

      <div className="container mx-auto max-w-7xl relative">
        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-center">
            {/* Renders one circle+label per step, with a connector line between
                consecutive steps. React.Fragment groups the circle and the
                connector line without adding an extra wrapper <div> to the DOM. */}
            {steps.map((step, index) => {
              const isDone = currentStepIndex > index;
              const isActive = currentStep === step.id;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center">
                    <motion.div
                      animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-colors duration-300 ${
                        isActive || isDone
                          ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/40'
                          : 'glass-card text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {/* Swaps between a checkmark (done) and the step number (not done yet),
                          animating the swap via AnimatePresence so it doesn't just pop instantly. */}
                      <AnimatePresence mode="wait" initial={false}>
                        {isDone ? (
                          <motion.span key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                            <Check size={20} />
                          </motion.span>
                        ) : (
                          <motion.span key="num" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {step.icon}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <span className={`ml-3 hidden sm:block font-medium transition-colors ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>{step.label}</span>
                  </div>
                  {/* Connector line to the next step — its fill width animates from 0% to 100% once this step is done. Skipped after the last step. */}
                  {index < steps.length - 1 && (
                    <div className="w-16 sm:w-24 h-1 mx-2 rounded-full bg-gray-200 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary-dark"
                        initial={false}
                        animate={{ width: isDone ? '100%' : '0%' }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
          {/* AnimatePresence with mode="wait" makes sure the outgoing step
              finishes its exit animation before the next step's enter
              animation starts, instead of both animating at once. */}
          <AnimatePresence mode="wait">
            {/* Step 1: Select Dates */}
            {currentStep === 'dates' && (
              <motion.div key="dates" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="glass-card rounded-2xl p-4 sm:p-8">
                <h2 className="text-2xl font-heading font-bold mb-6">Select Your Dates</h2>

                {/* Room Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Select Room(s)
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">You can select multiple rooms</span>
                  </label>
                  <div className="space-y-3">
                    {roomsLoading && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-4">
                        <Loader2 size={16} className="animate-spin" /> Loading rooms…
                      </div>
                    )}
                    {!roomsLoading && rooms.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No rooms are available right now. Please check back later.</p>
                    )}
                    {/* One clickable card per room — clicking anywhere on the
                        card (except the "Details" link) toggles selection. */}
                    {rooms.map((r) => {
                      const isSelected = selectedRooms.includes(r.id);
                      return (
                        <motion.div
                          key={r.id}
                          onClick={() => handleRoomToggle(r.id)}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          className={`relative flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
                            isSelected
                              ? 'border-primary bg-primary-light shadow-lg shadow-primary/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:bg-white/60 dark:hover:bg-white/10 glass-card'
                          }`}
                        >
                          {r.image ? (
                            <img
                              src={r.image}
                              alt={r.name}
                              className="w-16 h-14 object-cover rounded-md flex-shrink-0 ring-1 ring-black/5"
                            />
                          ) : (
                            <div className="w-16 h-14 rounded-md flex-shrink-0 ring-1 ring-black/5 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center text-primary/40 font-bold">
                              {r.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(r.price)}/night &middot; Max {r.maxGuests} guests
                            </p>
                          </div>
                          {/* View Details link — stops propagation so it doesn't toggle the card */}
                          <a
                            href={`/rooms/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0 px-2 py-1 rounded hover:bg-primary-light transition-colors"
                            title="View room details"
                          >
                            <ExternalLink size={13} />
                            Details
                          </a>
                          {/* Circular checkbox indicator — animates the checkmark in/out with the selection state. */}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600 bg-white'
                            }`}
                          >
                            <AnimatePresence>
                              {isSelected && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                  <Check size={14} className="text-white" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {selectedRooms.length > 1 && (
                    <p className="mt-2 text-sm text-primary font-medium">
                      {selectedRooms.length} rooms selected &middot; {formatCurrency(totalNightlyRate)}/night combined
                    </p>
                  )}
                </div>

                {/* Number of Guests — a simple +/- stepper clamped between 1 and totalMaxGuests */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Number of Guests
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">(max {totalMaxGuests} across selected rooms)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setGuests(g => Math.max(1, g - 1))}
                      disabled={guests <= 1}
                      className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-primary hover:bg-primary-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[100px] text-center">
                      {guests} {guests === 1 ? 'Guest' : 'Guests'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuests(g => Math.min(totalMaxGuests, g + 1))}
                      disabled={guests >= totalMaxGuests}
                      className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-primary hover:bg-primary-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Calendar — a hand-built month view (no external date-picker library) */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <h3 className="text-base sm:text-lg font-semibold">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  {/* Weekday header row (Su, Mo, Tu, ...) */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 py-1 sm:py-2">{day}</div>
                    ))}
                  </div>

                  {/* Small inline spinner shown while /api/rooms/availability is loading */}
                  {availabilityLoading && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 dark:text-gray-500">
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Checking availability…
                    </div>
                  )}

                  {/* The actual day grid. `days` includes `null` placeholders
                      for the empty leading cells before the 1st of the month. */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {days.map((date, index) => {
                      if (!date) return <div key={`empty-${index}`} className="aspect-square" />;
                      const isSelected = isDateSelected(date);
                      const inRange = isDateInRange(date);
                      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                      const isBooked = !isPast && unavailableDates.has(toKey(date));
                      const isBlocked = isPast || isBooked;
                      return (
                        <motion.button
                          key={date.toISOString()}
                          onClick={() => !isBlocked && handleDateClick(date)}
                          disabled={isBlocked}
                          title={isBooked ? 'Already booked' : undefined}
                          whileTap={!isBlocked ? { scale: 0.88 } : undefined}
                          className={`
                            aspect-square flex items-center justify-center rounded-md sm:rounded-lg text-xs sm:text-sm transition-all relative
                            ${isPast  ? 'text-gray-300 cursor-not-allowed' : ''}
                            ${isBooked ? 'bg-red-50 text-red-400 cursor-not-allowed' : ''}
                            ${!isBlocked && !isSelected && !inRange ? 'hover:bg-primary-light/60 cursor-pointer text-gray-700 dark:text-gray-300' : ''}
                            ${isSelected ? 'bg-gradient-to-br from-primary to-primary-dark text-white font-semibold shadow-md shadow-primary/40 scale-105' : ''}
                            ${inRange ? 'bg-primary-light text-primary' : ''}
                          `}
                        >
                          {date.getDate()}
                          {/* Small red dot under booked dates, in addition to the red background, for extra clarity/accessibility. */}
                          {isBooked && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Legend explaining the calendar's colour coding */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-primary rounded" /><span className="text-gray-600 dark:text-gray-400">Selected</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-primary-light rounded" /><span className="text-gray-600 dark:text-gray-400">In Range</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-50 border border-red-200 rounded" /><span className="text-gray-600 dark:text-gray-400">Booked</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded" /><span className="text-gray-600 dark:text-gray-400">Past</span>
                    </div>
                  </div>

                  {/* Summary of the picked check-in/out shown once a check-in date exists */}
                  {checkInDate && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Check-in</p>
                          <p className="font-semibold">{formatDate(checkInDate)}</p>
                        </div>
                        {checkOutDate && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Check-out</p>
                            <p className="font-semibold">{formatDate(checkOutDate)}</p>
                          </div>
                        )}
                      </div>
                      {totals.nights > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{totals.nights} night{totals.nights !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  {/* Magnetic wraps the button with a subtle cursor-following hover effect (see components/ui/Magnetic.tsx). */}
                  <Magnetic strength={0.2} className="inline-block">
                    <Button variant="primary" size="lg" disabled={!canProceedToDetails} onClick={() => setCurrentStep('details')}>
                      Continue to Guest Details
                      <ChevronRight size={20} className="ml-2" />
                    </Button>
                  </Magnetic>
                </div>
              </motion.div>
            )}

            {/* Step 2: Guest Details — a plain controlled form; every input's
                value comes from `guestDetails` state and changes flow through
                the single handleGuestDetailsChange handler above. */}
            {currentStep === 'details' && (
              <motion.div key="details" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="glass-card rounded-2xl p-4 sm:p-8">
                <h2 className="text-2xl font-heading font-bold mb-6">Guest Information</h2>

                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                        <input type="text" name="firstName" value={guestDetails.firstName} onChange={handleGuestDetailsChange} required
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="John" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                        <input type="text" name="lastName" value={guestDetails.lastName} onChange={handleGuestDetailsChange} required
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Doe" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                      <input type="email" name="email" value={guestDetails.email} onChange={handleGuestDetailsChange} required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="john@example.com" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                      <input type="tel" name="phone" value={guestDetails.phone} onChange={handleGuestDetailsChange} required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="+94 12 345 6789" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                    {/* select-wrapper is a small CSS helper (see app/globals.css) that
                        adds a custom dropdown arrow icon over a native <select>. */}
                    <div className="select-wrapper">
                      <select name="country" value={guestDetails.country} onChange={handleGuestDetailsChange}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
                        <option value="">Select Country</option>
                        <option value="LK">Sri Lanka</option>
                        <option value="US">United States</option>
                        <option value="UK">United Kingdom</option>
                        <option value="IN">India</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                      <input type="text" name="address" value={guestDetails.address} onChange={handleGuestDetailsChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Your address" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Requests (Optional)</label>
                    <textarea name="specialRequests" value={guestDetails.specialRequests} onChange={handleGuestDetailsChange} rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Any special requests or requirements..." />
                  </div>
                </form>

                <div className="mt-6 flex gap-4 justify-between">
                  <Button variant="outline" size="lg" onClick={() => setCurrentStep('dates')}>Back</Button>
                  <Magnetic strength={0.2} className="inline-block">
                    <Button variant="primary" size="lg" disabled={!canProceedToPayment} onClick={() => setCurrentStep('payment')}>
                      Continue to Payment <ChevronRight size={20} className="ml-2" />
                    </Button>
                  </Magnetic>
                </div>
              </motion.div>
            )}

            {/* Step 3: Payment — choose between three online gateways (routed
                through PayHere) or a manual bank transfer, then apply an
                optional coupon and accept the terms before submitting. */}
            {currentStep === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="glass-card rounded-2xl p-4 sm:p-8">
                <h2 className="text-2xl font-heading font-bold mb-6">Payment Method</h2>

                {/* Online payment via PayHere */}
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-2">Pay Online via PayHere</p>
                <div className="space-y-3 mb-4">
                  {/* Three online options rendered from a small inline array
                      rather than being hand-duplicated three times in JSX. */}
                  {[
                    { value: 'card'    as const, label: 'Credit / Debit Card', sub: 'Visa, Mastercard, Amex',           icon: <CreditCard className="text-primary" size={24} /> },
                    { value: 'helapay' as const, label: 'HelaPay',              sub: 'Dialog Genie, Frimi & more',       icon: <Smartphone className="text-primary" size={24} /> },
                    { value: 'webxpay' as const, label: 'WebXPay',              sub: 'Local Sri Lankan payment gateway', icon: <Globe className="text-primary" size={24} /> },
                  ].map((m) => (
                    <motion.div key={m.value} onClick={() => setPaymentMethod(m.value)}
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${paymentMethod === m.value ? 'border-primary bg-primary-light shadow-lg shadow-primary/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary/40 glass-card'}`}>
                      <div className="flex items-center gap-3">
                        {m.icon}
                        <div>
                          <h3 className="font-semibold text-sm">{m.label}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{m.sub}</p>
                        </div>
                        <AnimatePresence>
                          {paymentMethod === m.value && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="ml-auto">
                              <Check className="text-primary" size={18} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Bank transfer — the "manual" payment method, kept separate from the array above since it has extra copy/behaviour */}
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-2">Manual Payment</p>
                <motion.div
                  onClick={() => setPaymentMethod('bank')}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 mb-6 ${paymentMethod === 'bank' ? 'border-primary bg-primary-light shadow-lg shadow-primary/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary/40 glass-card'}`}
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="text-primary" size={24} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">Direct Bank Transfer</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pay to our account — booking confirmed after receipt</p>
                    </div>
                    <AnimatePresence>
                      {paymentMethod === 'bank' && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="ml-auto">
                          <Check className="text-primary" size={18} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {/* Note: there are two identical checkmark blocks here (this
                        one and the one above) — looks like a leftover duplicate
                        from editing, not intentional, but left as-is since this
                        pass only adds comments and doesn't change behaviour. */}
                    <AnimatePresence>
                      {paymentMethod === 'bank' && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Check className="text-primary" size={18} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Bank details — shown only when bank is selected */}
                {paymentMethod === 'bank' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card rounded-lg p-4 mb-6 text-sm space-y-1">
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank Transfer Details</p>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Bank</span><span className="font-medium">Commercial Bank of Ceylon</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Account Name</span><span className="font-medium">White Vintage Bungalow</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Account No.</span><span className="font-medium">8000123456</span></div>
                    <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Branch</span><span className="font-medium">Nuwara Eliya</span></div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Use your booking reference as the payment reference.</p>
                  </motion.div>
                )}

                {/* Coupon — switches between an input+Apply button and a
                    "coupon applied" confirmation chip depending on whether
                    appliedCoupon is set. */}
                <div className="mb-6">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Tag size={15} /> Coupon Code
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-300 rounded-lg">
                      <span className="text-sm text-green-700 font-medium">
                        <Check size={14} className="inline mr-1" />
                        <strong>{appliedCoupon.code}</strong> — {appliedCoupon.discountPercent}% off applied!
                      </span>
                      <button onClick={handleRemoveCoupon} className="text-xs text-red-500 hover:underline ml-2">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        placeholder="Enter coupon code"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm uppercase tracking-wider" />
                      <button onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1">
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {couponError}
                    </p>
                  )}
                </div>

                {/* Terms checkbox — the "Confirm Booking" button below stays disabled until this is checked */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      I agree to the <a href="/terms" className="text-primary hover:underline">Terms and Conditions</a> and{' '}
                      <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                    </span>
                  </label>
                </div>

                <div className="flex gap-4 justify-between">
                  <Button variant="outline" size="lg" onClick={() => setCurrentStep('details')} disabled={submitting}>
                    Back
                  </Button>
                  <Magnetic strength={0.2} className="inline-block">
                    <Button variant="primary" size="lg" disabled={!agreedToTerms || submitting} onClick={handleSubmit}>
                      {submitting ? (
                        <><Loader2 size={18} className="animate-spin mr-2 inline" /> Processing...</>
                      ) : 'Confirm Booking'}
                    </Button>
                  </Magnetic>
                </div>
                {submitError && (
                  <p className="mt-3 text-sm text-red-600 flex items-center justify-center gap-1">
                    <AlertCircle size={14} /> {submitError}
                  </p>
                )}
              </motion.div>
            )}

            {/* Step 4: Confirmation — content differs depending on payment
                method: bank transfer shows a "pending, please upload your
                receipt" state, while online payments show an immediate
                "confirmed" state (PayHere's redirect only gets here on success). */}
            {currentStep === 'confirmation' && (
              <motion.div key="confirmation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="glass-card rounded-2xl p-4 sm:p-8 text-center">

                {paymentMethod === 'bank' ? (
                  /* ── Bank Transfer: Payment Pending ── */
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                      className="relative w-20 h-20 mx-auto mb-6"
                    >
                      {/* animate-ping creates the expanding/fading "pulse ring" effect behind the icon */}
                      <div className="absolute inset-0 rounded-full bg-amber-300/40 animate-ping" />
                      <div className="relative w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                        <Clock className="text-amber-600" size={40} />
                      </div>
                    </motion.div>
                    <h2 className="text-3xl font-heading font-bold mb-2">Booking Received!</h2>
                    <p className="text-amber-600 font-semibold mb-2">Payment Pending — Awaiting Transfer</p>
                    <p className="text-lg font-semibold mb-6">
                      Booking Reference: <span className="text-primary">{bookingReference}</span>
                    </p>

                    {/* Upload CTA — links to the separate /booking/upload-receipt page, passing the booking reference in the URL */}
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 mb-6 text-left">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Upload className="text-amber-600" size={22} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Upload Your Transfer Receipt</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Your booking is <strong>not confirmed yet</strong>. To complete your reservation, please transfer the amount to our bank account and upload your receipt. We will confirm your booking within <strong>2–4 hours</strong> of verification.
                          </p>
                          <a
                            href={`/booking/upload-receipt?ref=${bookingReference}`}
                            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
                          >
                            <Upload size={16} />
                            Upload Receipt Now
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Bank details reminder — repeats the same details shown on the payment step, for guests who scrolled straight past that. */}
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 text-left text-sm space-y-1">
                      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank Transfer Details</p>
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Bank</span><span className="font-medium">Commercial Bank of Ceylon</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Account Name</span><span className="font-medium">White Vintage Bungalow</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Account No.</span><span className="font-medium">8000123456</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Branch</span><span className="font-medium">Nuwara Eliya</span></div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Use <strong>{bookingReference}</strong> as your payment reference.</p>
                    </div>
                  </>
                ) : (
                  /* ── Online Payment: Confirmed ── */
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                      className="relative w-20 h-20 mx-auto mb-6"
                    >
                      <div className="absolute inset-0 rounded-full bg-green-300/40 animate-ping" />
                      <div className="relative w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="text-green-600" size={40} />
                      </div>
                    </motion.div>
                    <h2 className="text-3xl font-heading font-bold mb-4">Booking Confirmed!</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">Thank you for your reservation</p>
                    <p className="text-lg font-semibold mb-6">
                      Booking Reference: <span className="text-primary">{bookingReference}</span>
                    </p>
                  </>
                )}

                {/* Booking details (shared) — this block renders regardless of payment method */}
                <div className="bg-primary-light p-6 rounded-lg mb-6 text-left">
                  <h3 className="font-semibold mb-4">Booking Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Guest Name:</span>
                      <span className="font-medium">{guestDetails.firstName} {guestDetails.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Room{selectedRoomObjects.length > 1 ? 's' : ''}:</span>
                      <span className="font-medium text-right max-w-[60%]">{selectedRoomObjects.map(r => r.name).join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Check-in:</span>
                      <span className="font-medium">{checkInDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Check-out:</span>
                      <span className="font-medium">{checkOutDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Guests:</span>
                      <span className="font-medium">{guests} Guest{guests > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                      <span className="font-medium">{formatCurrency(totals.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg mb-6 text-left">
                  <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {paymentMethod === 'bank'
                      ? <>A confirmation email with your bank transfer instructions and receipt upload link has been sent to <strong>{guestDetails.email}</strong>.</>
                      : <>A confirmation email has been sent to <strong>{guestDetails.email}</strong> with all booking details.</>
                    }
                  </p>
                </div>

                {/* Final call-to-action buttons — different primary action depending on payment method */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {paymentMethod === 'bank' ? (
                    <Button variant="primary" size="lg" onClick={() => window.location.href = `/booking/upload-receipt?ref=${bookingReference}`}>
                      <Upload size={18} className="mr-2 inline" /> Upload Receipt
                    </Button>
                  ) : (
                    <Button variant="primary" size="lg" onClick={() => window.location.href = '/profile?tab=bookings'}>
                      View My Bookings
                    </Button>
                  )}
                  <Button variant="outline" size="lg" onClick={() => window.location.href = '/'}>Return to Home</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          {/* Booking Summary Sidebar — sticky so it stays visible while
              scrolling the (potentially long) form on the left, and updates
              live as the guest changes rooms/dates/coupon. */}
          <div className="lg:col-span-1">
            <div className="glass-strong rounded-2xl p-6 sticky top-24 hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-xl font-heading font-semibold mb-4">Booking Summary</h3>

              <div className="mb-4 pb-4 border-b space-y-3">
                {selectedRoomObjects.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="w-16 h-12 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-12 rounded-md flex-shrink-0 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center text-primary/40 font-bold text-sm">
                        {r.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(r.price)}/night</p>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-gray-600 dark:text-gray-400">{guests} Guest{guests > 1 ? 's' : ''}</p>
              </div>

              {/* Dates block — only rendered once both check-in and check-out are picked */}
              {checkInDate && checkOutDate && (
                <div className="mb-4 pb-4 border-b space-y-2">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Check-in</p>
                    <p className="font-medium">{checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Check-out</p>
                    <p className="font-medium">{checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                    <p className="font-medium">{totals.nights} night{totals.nights > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}

              {/* Price breakdown — per-room subtotal, discount (if a coupon is
                  applied), tax, and the animated final total. */}
              {checkInDate && checkOutDate && (
                <div className="space-y-2">
                  {selectedRoomObjects.map((r) => (
                    <div key={r.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400 truncate mr-2">{r.name} × {totals.nights}n</span>
                      <span className="font-medium flex-shrink-0">{formatCurrency(r.price * totals.nights)}</span>
                    </div>
                  ))}
                  {appliedCoupon && totals.discount > 0 && (
                    <div className="flex justify-between text-green-600 text-sm">
                      <span>Discount ({appliedCoupon.discountPercent}% — {appliedCoupon.code})</span>
                      <span className="font-medium">−{formatCurrency(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Taxes & Fees (10%)</span>
                    <span className="font-medium">{formatCurrency(totals.tax)}</span>
                  </div>
                  <div className="pt-3 border-t flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    {/* `key={totals.total}` forces AnimatePresence to treat every
                        total change as a brand-new element, so the pop/fade-in
                        animation replays each time the price updates. */}
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={totals.total}
                        initial={{ scale: 1.15, opacity: 0.4 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="text-primary"
                      >
                        {formatCurrency(totals.total)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-primary-light rounded-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
                <p className="text-sm text-gray-700 dark:text-gray-300 relative">
                  <Check className="inline text-primary mr-2" size={16} />
                  Free cancellation within 24 hours
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// The actual default export for this route. It just wraps the real content
// in a <Suspense> boundary (required because BookingPageContent calls
// useSearchParams) with a full-screen spinner shown while that resolves.
export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
