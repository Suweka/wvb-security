// This page lets a guest who paid by bank transfer submit proof of payment
// (transaction reference, date, amount, and an optional receipt photo). It uploads
// the image straight to Cloudinary from the browser, then POSTs the form data to
// our own API (/api/bookings/upload-receipt) so an admin can verify and confirm the booking.

// 'use client' — needed because this page has form state, file drag-and-drop, and
// reads the URL query string, all of which require running in the browser.
'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Upload, Loader2, ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';

// Formats a JS Date as "YYYY-MM-DD" (ISO date, no time) for storing/sending to the API.
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Turns a "YYYY-MM-DD" string back into a JS Date object (the inverse of toISODate),
// used to feed the current value into the DatePickerField component.
function parseISODate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Uploads the selected receipt image directly to Cloudinary (an image hosting service)
// from the browser, in two steps, so large images don't have to pass through our own
// server (which would hit Vercel's request body size limit).
async function uploadToCloudinary(file: File): Promise<string> {
  // Step 1 — get a signed upload signature from our server
  const sigRes = await fetch('/api/upload/signature');
  if (!sigRes.ok) throw new Error('Could not get upload signature');
  const { signature, timestamp, folder, cloudName, apiKey } = await sigRes.json();

  // Step 2 — upload directly to Cloudinary (bypasses Vercel body-size limit)
  const form = new FormData();
  form.append('file', file);
  form.append('signature', signature);
  form.append('timestamp', String(timestamp));
  form.append('api_key', apiKey);
  form.append('folder', folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form }
  );
  if (!uploadRes.ok) throw new Error('Image upload failed');
  const data = await uploadRes.json();
  return data.secure_url as string;
}

// Inner component with all the form logic. Split out from the default-exported page
// so it can be wrapped in <Suspense> below (useSearchParams needs that boundary).
function UploadReceiptContent() {
  const searchParams  = useSearchParams();
  // If the guest arrived via a link like /booking/upload-receipt?ref=WVB-..., pre-fill the field.
  const refFromUrl    = searchParams.get('ref') || '';

  // React state hooks — each call creates a piece of state that, when updated via its
  // setter function, causes this component to re-render with the new value.
  // These five hold the values of the form's text/date/number inputs.
  const [bookingRef,     setBookingRef]     = useState(refFromUrl);
  const [transactionRef, setTransactionRef] = useState('');
  const [transferDate,   setTransferDate]   = useState('');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [notes,          setNotes]          = useState('');

  // State for the optional receipt image: the selected File object, a local preview URL,
  // and various loading/status flags used to drive the UI (spinners, error messages, etc).
  const [receiptFile,    setReceiptFile]    = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [success,        setSuccess]        = useState(false);
  const [error,          setError]          = useState('');

  // A ref to the hidden <input type="file"> element so we can programmatically
  // trigger its click (open the file picker) and reset its value when clearing.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Runs when the guest picks a file via the file input (or drag-and-drop, see handleDrop).
  // Validates the file is an image under 8 MB, then stores it and generates a local
  // preview URL so the guest can see the image before submitting.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be smaller than 8 MB.');
      return;
    }
    setError('');
    setReceiptFile(file);
    // URL.createObjectURL creates a temporary local URL pointing at the in-memory file,
    // so the <img> preview can show it without uploading anything yet.
    setReceiptPreview(URL.createObjectURL(file));
  };

  // Handles a file being dropped onto the drop-zone; reuses handleFileChange's validation
  // logic by faking an input change event shape.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange({ target: { files: e.dataTransfer.files } } as any);
  };

  // Removes the currently selected/previewed receipt image and resets the file input.
  const clearFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Runs when the form is submitted. Validates required fields, optionally uploads the
  // receipt image to Cloudinary first, then POSTs all the payment details to our API.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // stop the browser from doing a full page reload on submit
    if (!bookingRef.trim() || !transactionRef.trim() || !transferDate || !amountPaid) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');

    let receiptUrl = '';

    // Upload image to Cloudinary if one was selected
    if (receiptFile) {
      setUploading(true);
      try {
        receiptUrl = await uploadToCloudinary(receiptFile);
      } catch (err) {
        setError('Image upload failed. Please try again or submit without an image.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setSubmitting(true);
    try {
      // Send the bank-transfer details (plus the Cloudinary image URL, if any) to our
      // own API route, which stores it for an admin to review and confirm the booking.
      const res = await fetch('/api/bookings/upload-receipt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          bookingNumber: bookingRef.trim().toUpperCase(),
          transactionRef,
          transferDate,
          amountPaid:    Number(amountPaid),
          receiptUrl,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Submission failed.'); return; }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Conditional rendering: once the receipt has been submitted successfully, show a
  // confirmation screen instead of the form (an "early return" pattern).
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 flex items-center justify-center px-4 py-16">
        <div className="glass-strong rounded-2xl shadow-lg p-10 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-500" size={44} />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-3">Receipt Submitted!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Thank you. We have received your payment details for booking{' '}
            <span className="font-semibold text-primary">{bookingRef}</span>.
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            Our team will verify your transfer and confirm your booking within <strong>2–4 hours</strong> during business hours.
            You will receive a confirmation email once approved.
          </p>
          <Button variant="primary" size="lg" onClick={() => window.location.href = '/'}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Convenience flag: true while either the image upload or the form submission is in
  // flight, used to disable the submit button and show the right spinner text.
  const isBusy = uploading || submitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 py-16 px-4">
      <div className="container mx-auto max-w-xl">
        <div className="glass-strong rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
              <Upload className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold">Submit Payment Receipt</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">White Vintage Bungalow — Bank Transfer Confirmation</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
            Fill in your bank transfer details and upload a photo or screenshot of your receipt. Your booking will be confirmed after our team verifies the payment.
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Booking reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Booking Reference <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bookingRef}
                onChange={e => setBookingRef(e.target.value.toUpperCase())}
                placeholder="WVB-2026-XXXXXX"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider"
                required
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Found in your booking confirmation email.</p>
            </div>

            {/* Transaction reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Transaction / Reference No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g. TRX2026061100234"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Date */}
            <div>
              {/* Immediately-invoked function so we can compute minDate/today with
                  plain JS statements before returning the JSX for the date picker */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Guests can only pick a transfer date within the last year, up to today
                const minDate = new Date(today);
                minDate.setFullYear(minDate.getFullYear() - 1);
                return (
                  <DatePickerField
                    label={<>Date of Transfer <span className="text-red-500">*</span></>}
                    value={parseISODate(transferDate)}
                    minDate={minDate}
                    maxDate={today}
                    onChange={d => setTransferDate(toISODate(d))}
                  />
                );
              })()}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount Transferred (LKR) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">LKR</span>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  className="w-full pl-12 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            {/* Receipt Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Receipt Image <span className="text-gray-400 dark:text-gray-500 font-normal">(optional but recommended)</span>
              </label>

              {receiptPreview ? (
                /* Preview */
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full max-h-64 object-contain bg-gray-50 dark:bg-gray-900"
                  />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <div className="px-3 py-2 bg-green-50 border-t border-green-200 text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle size={12} /> {receiptFile?.name}
                  </div>
                </div>
              ) : (
                /* Drop zone */
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary-light/30 transition-colors"
                >
                  <ImageIcon className="mx-auto text-gray-400 dark:text-gray-500 mb-3" size={36} />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload or drag & drop</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG, PNG, WEBP — max 8 MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional information about the transfer..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isBusy}
            >
              {uploading ? (
                <><Loader2 size={18} className="animate-spin mr-2 inline" /> Uploading image...</>
              ) : submitting ? (
                <><Loader2 size={18} className="animate-spin mr-2 inline" /> Submitting...</>
              ) : (
                'Submit Receipt'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// The route's page component. Wraps the form in <Suspense> because UploadReceiptContent
// uses useSearchParams(), which requires a Suspense boundary in the App Router.
export default function UploadReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    }>
      <UploadReceiptContent />
    </Suspense>
  );
}
