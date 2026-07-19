// Admin page — Reservations.
// The main bookings table: search/filter, view details, edit dates/room/
// guest count, cancel a booking, and review bank-transfer payment receipts
// (approve confirms the booking + emails the guest, reject cancels it).
// Wrapped in <Suspense> because it reads the ?q= URL search param.
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Search, Plus, Eye, Trash2, Loader2, AlertCircle, RefreshCw, CheckCircle, XCircle, FileText, ExternalLink, X, Pencil } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { getReservationsData, getRoomsData } from '@/lib/admin-actions';

// Lifecycle states a reservation can be in.
type ReservationStatus = 'confirmed' | 'pending' | 'cancelled';
// Review states for a submitted bank-transfer payment receipt.
type ReceiptStatus     = 'PENDING' | 'APPROVED' | 'REJECTED';

// Shape of a bank-transfer receipt attached to a reservation (guests upload
// these when paying by bank transfer instead of card).
interface Receipt {
  id:             string;
  transactionRef: string | null;
  transferDate:   string | null;
  amountPaid:     number | null;
  receiptUrl:     string | null;
  notes:          string | null;
  status:         ReceiptStatus;
}

// Shape of a reservation row as returned by the API.
interface Reservation {
  id:            string;
  guestName:     string;
  email:         string;
  phone:         string;
  room:          string;
  roomId:        string;
  checkIn:       string;
  checkOut:      string;
  nights:        number;
  amount:        number;
  status:        ReservationStatus;
  guests:        number;
  paymentMethod: string | null;
  receipt:       Receipt | null;
}

// Minimal room info used to populate the "Room" dropdown in the edit modal.
interface RoomOption {
  id:    string;
  name:  string;
  price: number;
}

// Actual page content. Split out so it can be wrapped in <Suspense> below
// (useSearchParams() requires a Suspense boundary in Next.js's App Router).
function ReservationsContent() {
  // Reads the current URL's query string to pre-fill the search box if the
  // admin arrived via a search link (e.g. from the header's global search).
  const searchParams = useSearchParams();
  const [searchQuery,     setSearchQuery]     = useState(searchParams.get('q') || '');
  const [filterStatus,    setFilterStatus]    = useState<ReservationStatus | 'all'>('all');
  const [reservations,    setReservations]    = useState<Reservation[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(false);
  // The reservation whose bank-transfer receipt is being reviewed in a modal.
  const [selectedReceipt, setSelectedReceipt] = useState<Reservation | null>(null);
  const [reviewLoading,   setReviewLoading]   = useState(false);
  const [reviewMessage,   setReviewMessage]   = useState('');
  // The reservation shown in the read-only "view details" modal.
  const [viewDetail,      setViewDetail]      = useState<Reservation | null>(null);
  // Tracks which single reservation is currently being cancelled, so only
  // its button shows a spinner.
  const [cancellingId,    setCancellingId]    = useState<string | null>(null);
  const [rooms,           setRooms]           = useState<RoomOption[]>([]);
  // The reservation currently open in the "Edit Reservation" modal.
  const [editTarget,      setEditTarget]      = useState<Reservation | null>(null);
  const [editForm,        setEditForm]        = useState({ roomId: '', checkIn: '', checkOut: '', guests: 1 });
  const [editLoading,     setEditLoading]     = useState(false);
  const [editError,       setEditError]       = useState('');

  // "New Reservation" modal — for logging a booking an admin took by phone,
  // WhatsApp, or from a guest who walked in and booked in person.
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    source: 'PHONE' as 'PHONE' | 'WHATSAPP' | 'WALK_IN',
    roomId: '', checkIn: '', checkOut: '', guests: 1,
    firstName: '', lastName: '', phone: '', email: '',
    specialRequests: '', paymentStatus: 'PENDING' as 'PENDING' | 'PAID',
  });
  const [newLoading, setNewLoading] = useState(false);
  const [newError,   setNewError]   = useState('');

  // Loads the full reservations list from the server action.
  async function fetchReservations() {
    setLoading(true);
    setError(false);
    const data = await getReservationsData();
    if (data) setReservations(data as Reservation[]);
    else       setError(true);
    setLoading(false);
  }

  // Runs once on mount: loads reservations, and separately loads the room
  // list (for the edit modal's room dropdown, including current prices).
  useEffect(() => {
    fetchReservations();
    getRoomsData().then(data => { if (data) setRooms(data.map(r => ({ id: r.id, name: r.name, price: r.price }))); });
  }, []);

  // Opens the "Edit Reservation" modal, pre-filling the form with the
  // reservation's current room/dates/guest count.
  function openEdit(res: Reservation) {
    setEditTarget(res);
    setEditForm({ roomId: res.roomId, checkIn: res.checkIn, checkOut: res.checkOut, guests: res.guests });
    setEditError('');
  }

  // Submits the edit form via PATCH, then refetches the reservation list to
  // pick up recalculated pricing/nights from the server.
  async function handleEditSubmit() {
    if (!editTarget) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(`/api/admin/reservations/${editTarget.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'edit', ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update reservation.'); return; }
      setEditTarget(null);
      setViewDetail(null);
      fetchReservations();
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }

  // Resets the "New Reservation" form back to its defaults and opens the modal.
  function openNewReservation() {
    setNewForm({
      source: 'PHONE', roomId: rooms[0]?.id || '', checkIn: '', checkOut: '', guests: 1,
      firstName: '', lastName: '', phone: '', email: '', specialRequests: '', paymentStatus: 'PENDING',
    });
    setNewError('');
    setShowNewModal(true);
  }

  // Submits a manually-logged reservation (phone/WhatsApp/walk-in) via
  // POST, then refetches the list so it appears with server-calculated
  // pricing/nights like every other reservation.
  async function handleCreateReservation() {
    const { roomId, checkIn, checkOut, guests, firstName, lastName, phone } = newForm;
    if (!roomId || !checkIn || !checkOut || !firstName.trim() || !lastName.trim() || !phone.trim()) {
      setNewError('Room, dates, guest count, name, and phone are all required.');
      return;
    }
    setNewLoading(true);
    setNewError('');
    try {
      const res = await fetch('/api/admin/reservations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...newForm, guests: Number(guests) }),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.error || 'Failed to create reservation.'); return; }
      setShowNewModal(false);
      fetchReservations();
    } catch {
      setNewError('Network error. Please try again.');
    } finally {
      setNewLoading(false);
    }
  }

  // Applies the search box and status filter to the full reservation list.
  const filteredReservations = reservations.filter((res) => {
    const matchesSearch =
      res.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || res.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Bank-transfer bookings whose receipt hasn't been approved/rejected yet —
  // surfaced in a banner at the top so staff don't miss them.
  const pendingReceipts = reservations.filter(r => r.paymentMethod === 'bank' && r.receipt?.status === 'PENDING');

  // Cancels a reservation after a confirmation prompt (irreversible action),
  // then updates that row's status locally instead of refetching everything.
  async function handleCancel(bookingId: string) {
    if (!confirm('Cancel this reservation? This cannot be undone.')) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/admin/reservations/${bookingId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) throw new Error();
      setReservations(prev => prev.map(r => r.id === bookingId ? { ...r, status: 'cancelled' as const } : r));
    } catch {
      alert('Failed to cancel reservation. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  // Approves or rejects a bank-transfer receipt. Approving confirms the
  // booking and triggers a confirmation email to the guest (handled
  // server-side); rejecting cancels the booking. Either way, refetches the
  // reservation list afterward to reflect the new status.
  async function handleReceiptAction(receiptId: string, action: 'approve' | 'reject') {
    setReviewLoading(true);
    setReviewMessage('');
    try {
      const res = await fetch(`/api/admin/receipts/${receiptId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { setReviewMessage(data.error || 'Action failed.'); return; }
      setReviewMessage(action === 'approve' ? '✅ Booking confirmed and confirmation email sent.' : '❌ Booking cancelled.');
      setSelectedReceipt(null);
      fetchReservations();
    } catch {
      setReviewMessage('Network error. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  }

  // Maps a reservation status to its badge color classes.
  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending':   return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default:          return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  if (error)   return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load reservations data.</p>
      <button onClick={fetchReservations} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Reservations</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage all guest reservations</p>
        </div>
        <button onClick={fetchReservations} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Pending receipts banner */}
      {pendingReceipts.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-6 flex items-start gap-3">
          <FileText className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-orange-800">
              {pendingReceipts.length} bank transfer receipt{pendingReceipts.length > 1 ? 's' : ''} pending review
            </p>
            <div className="mt-2 space-y-1">
              {pendingReceipts.map(r => (
                <button key={r.id} onClick={() => { setSelectedReceipt(r); setReviewMessage(''); }}
                  className="block text-sm text-orange-700 hover:underline text-left">
                  {r.id} — {r.guestName} → Review receipt
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reviewMessage && !selectedReceipt && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">{reviewMessage}</div>
      )}

      {/* Controls */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input type="text" placeholder="Search by guest name, email, or booking ID"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ReservationStatus | 'all')}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={openNewReservation} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2">
              <Plus size={20} /><span className="hidden sm:inline">New Reservation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Booking ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Guest</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Room</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Dates</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  {reservations.length === 0 ? 'No reservations yet.' : 'No reservations match your search.'}
                </td></tr>
              ) : filteredReservations.map((res) => (
                <tr key={res.id} className="border-b hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-primary text-sm">{res.id}</span>
                    {res.paymentMethod === 'bank' && (
                      <div className="mt-1">
                        {!res.receipt
                          ? <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Awaiting receipt</span>
                          : res.receipt.status === 'PENDING'
                          ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Receipt pending review</span>
                          : res.receipt.status === 'APPROVED'
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Receipt approved</span>
                          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Receipt rejected</span>
                        }
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{res.guestName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{res.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{res.room}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{res.guests} guest{res.guests > 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{res.checkIn} → {res.checkOut}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{res.nights} night{res.nights > 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold">LKR {res.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(res.status)}`}>
                      {res.status.charAt(0).toUpperCase() + res.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewDetail(res)}
                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-600" title="View"
                      ><Eye size={18} /></button>
                      {res.status !== 'cancelled' && (
                        <button
                          onClick={() => openEdit(res)}
                          className="p-2 hover:bg-primary/10 rounded-lg text-primary" title="Edit"
                        ><Pencil size={18} /></button>
                      )}
                      {res.paymentMethod === 'bank' && res.receipt?.status === 'PENDING' && (
                        <button onClick={() => { setSelectedReceipt(res); setReviewMessage(''); }}
                          className="p-2 hover:bg-orange-100 rounded-lg text-orange-600" title="Review Receipt">
                          <FileText size={18} />
                        </button>
                      )}
                      {res.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancel(res.id)}
                          disabled={cancellingId === res.id}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600 disabled:opacity-40" title="Cancel"
                        >
                          {cancellingId === res.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        {[
          { label: 'Total Reservations', value: reservations.length, color: 'text-primary' },
          { label: 'Confirmed',          value: reservations.filter(r => r.status === 'confirmed').length,  color: 'text-green-600' },
          { label: 'Pending',            value: reservations.filter(r => r.status === 'pending').length,    color: 'text-yellow-600' },
          { label: 'Total Revenue',      value: `LKR ${reservations.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.amount, 0).toLocaleString()}`, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="glass-card hover-lift rounded-2xl p-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Receipt Review Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-heading font-bold">Review Bank Transfer Receipt</h2>
              <button onClick={() => { setSelectedReceipt(null); setReviewMessage(''); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Booking Details</p>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Booking Ref</span><span className="font-semibold text-primary">{selectedReceipt.id}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Guest</span><span>{selectedReceipt.guestName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Email</span><span>{selectedReceipt.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Room</span><span>{selectedReceipt.room}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Dates</span><span>{selectedReceipt.checkIn} → {selectedReceipt.checkOut}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Booking Amount</span><span className="font-bold">LKR {selectedReceipt.amount.toLocaleString()}</span></div>
              </div>

              {selectedReceipt.receipt ? (
                <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 text-sm space-y-2">
                  <p className="font-semibold text-orange-800 mb-2">Customer Submitted Receipt</p>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Transaction Ref</span><span className="font-mono font-medium">{selectedReceipt.receipt.transactionRef || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Transfer Date</span><span>{selectedReceipt.receipt.transferDate || '—'}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount Paid</span>
                    <span className={`font-bold ${selectedReceipt.receipt.amountPaid && selectedReceipt.receipt.amountPaid < selectedReceipt.amount ? 'text-red-600' : 'text-green-700'}`}>
                      LKR {selectedReceipt.receipt.amountPaid?.toLocaleString() || '—'}
                      {selectedReceipt.receipt.amountPaid && selectedReceipt.receipt.amountPaid < selectedReceipt.amount && ' ⚠ Less than required'}
                    </span>
                  </div>
                  {selectedReceipt.receipt.notes && (
                    <div className="pt-2 border-t border-orange-200">
                      <span className="text-gray-600 dark:text-gray-400">Notes: </span>{selectedReceipt.receipt.notes}
                    </div>
                  )}
                  {selectedReceipt.receipt.receiptUrl && (
                    <a href={selectedReceipt.receipt.receiptUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-primary hover:underline mt-2 font-medium">
                      <ExternalLink size={14} /> View Receipt Image
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Customer has not submitted a receipt yet.
                </div>
              )}

              {reviewMessage && (
                <p className="text-sm text-center font-medium py-2">{reviewMessage}</p>
              )}
            </div>

            <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => selectedReceipt.receipt && handleReceiptAction(selectedReceipt.receipt.id, 'reject')}
                disabled={reviewLoading || !selectedReceipt.receipt}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-medium transition-colors"
              >
                {reviewLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject
              </button>
              <button
                onClick={() => selectedReceipt.receipt && handleReceiptAction(selectedReceipt.receipt.id, 'approve')}
                disabled={reviewLoading || !selectedReceipt.receipt}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                {reviewLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Approve & Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Booking Details</h2>
              <button onClick={() => setViewDetail(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Booking Ref</span><span className="font-semibold text-primary">{viewDetail.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Guest</span><span className="font-medium">{viewDetail.guestName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Email</span><span>{viewDetail.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Phone</span><span>{viewDetail.phone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Room</span><span>{viewDetail.room}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Guests</span><span>{viewDetail.guests}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Check-in</span><span>{viewDetail.checkIn}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Check-out</span><span>{viewDetail.checkOut}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Nights</span><span>{viewDetail.nights}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Payment</span><span className="capitalize">{viewDetail.paymentMethod || '—'}</span></div>
              <div className="flex justify-between border-t pt-3 mt-3">
                <span className="text-gray-500 dark:text-gray-400">Total Amount</span>
                <span className="font-bold text-lg">LKR {viewDetail.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  viewDetail.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  viewDetail.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-red-100 text-red-700'
                }`}>{viewDetail.status.charAt(0).toUpperCase() + viewDetail.status.slice(1)}</span>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              {viewDetail.status !== 'cancelled' && (
                <>
                  <button
                    onClick={() => openEdit(viewDetail)}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setViewDetail(null); handleCancel(viewDetail.id); }}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    Cancel Booking
                  </button>
                </>
              )}
              <button
                onClick={() => setViewDetail(null)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reservation Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Edit Reservation — {editTarget.id}</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
                <select
                  value={editForm.roomId}
                  onChange={(e) => setEditForm(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} — LKR {r.price.toLocaleString()}/night</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in</label>
                  <input
                    type="date"
                    value={editForm.checkIn}
                    onChange={(e) => setEditForm(f => ({ ...f, checkIn: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out</label>
                  <input
                    type="date"
                    value={editForm.checkOut}
                    onChange={(e) => setEditForm(f => ({ ...f, checkOut: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guests</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.guests}
                  onChange={(e) => setEditForm(f => ({ ...f, guests: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {editLoading && <Loader2 size={16} className="animate-spin" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Reservation Modal — for logging a phone/WhatsApp/walk-in booking */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-heading font-bold">New Reservation</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 -mt-1">
                For reservations taken outside the website — over the phone, on WhatsApp, or from a guest booking in person.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">How was this booked? *</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'PHONE',    label: 'Phone Call' },
                    { value: 'WHATSAPP', label: 'WhatsApp' },
                    { value: 'WALK_IN',  label: 'Walk-in' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewForm(f => ({ ...f, source: opt.value }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        newForm.source === opt.value
                          ? 'border-primary bg-primary-light text-primary'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newForm.firstName}
                    onChange={(e) => setNewForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newForm.lastName}
                    onChange={(e) => setNewForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={newForm.phone}
                    onChange={(e) => setNewForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room *</label>
                <select
                  value={newForm.roomId}
                  onChange={(e) => setNewForm(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" disabled>Select a room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} — LKR {r.price.toLocaleString()}/night</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in *</label>
                  <input
                    type="date"
                    value={newForm.checkIn}
                    onChange={(e) => setNewForm(f => ({ ...f, checkIn: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out *</label>
                  <input
                    type="date"
                    value={newForm.checkOut}
                    onChange={(e) => setNewForm(f => ({ ...f, checkOut: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guests</label>
                  <input
                    type="number"
                    min={1}
                    value={newForm.guests}
                    onChange={(e) => setNewForm(f => ({ ...f, guests: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment</label>
                  <select
                    value={newForm.paymentStatus}
                    onChange={(e) => setNewForm(f => ({ ...f, paymentStatus: e.target.value as 'PENDING' | 'PAID' }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="PENDING">Not paid yet</option>
                    <option value="PAID">Already paid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Special Requests (optional)</label>
                <textarea
                  value={newForm.specialRequests}
                  onChange={(e) => setNewForm(f => ({ ...f, specialRequests: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {newError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{newError}</p>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReservation}
                disabled={newLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {newLoading && <Loader2 size={16} className="animate-spin" />} Create Reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The actual default export for this route. Suspense shows a spinner
// fallback while ReservationsContent (which depends on useSearchParams)
// resolves.
export default function ReservationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <ReservationsContent />
    </Suspense>
  );
}
