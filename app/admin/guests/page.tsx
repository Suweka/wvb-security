'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
  Search, Plus, Eye, Mail, Phone, MapPin, Calendar,
  Loader2, AlertCircle, RefreshCw, XCircle,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { getGuestsData } from '@/lib/admin-actions';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  totalStays: number;
  totalSpent: number;
  lastVisit: string | null;
  joinDate: string;
  type: 'registered' | 'guest';
}

interface BookingDetail {
  bookingNumber: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  status: string;
  paymentMethod: string;
}

interface GuestDetail {
  name: string;
  email: string;
  phone: string;
  country: string;
  type: 'registered' | 'guest';
  joinDate: string;
}

interface AddForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

function GuestsContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filterType, setFilterType] = useState<'all' | 'registered' | 'guest'>('all');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Detail modal state
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [detailData, setDetailData] = useState<{ guest: GuestDetail; bookings: BookingDetail[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add guest modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ firstName: '', lastName: '', email: '', phone: '', country: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchGuests() {
    setLoading(true);
    setError(false);
    const data = await getGuestsData();
    if (data) {
      setGuests(data);
    } else {
      setError(true);
    }
    setLoading(false);
  }

  useEffect(() => { fetchGuests(); }, []);

  async function openDetail(guest: Guest) {
    setSelectedGuest(guest);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/guests/${guest.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailData(json);
      }
    } catch {
      // leave detailData null — show error in modal
    }
    setDetailLoading(false);
  }

  function closeDetail() {
    setSelectedGuest(null);
    setDetailData(null);
  }

  async function handleAddGuest(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!addForm.firstName || !addForm.lastName || !addForm.email) {
      setAddError('First name, last name, and email are required.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error ?? 'Failed to add guest.');
      } else {
        setShowAddModal(false);
        setAddForm({ firstName: '', lastName: '', email: '', phone: '', country: '' });
        setSuccessMsg('Guest added successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
        fetchGuests();
      }
    } catch {
      setAddError('Network error. Please try again.');
    }
    setAddLoading(false);
  }

  const filteredGuests = guests.filter((guest) => {
    const matchesSearch =
      guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || guest.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="text-red-500" size={40} />
        <p className="text-gray-600">Failed to load guests data.</p>
        <button onClick={fetchGuests} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
      </div>
    );
  }

  const totalRevenue = guests.reduce((sum, g) => sum + g.totalSpent, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Guests</h1>
          <p className="text-gray-600">Manage guest information and profiles</p>
        </div>
        <button onClick={fetchGuests} className="text-sm flex items-center gap-1 text-gray-500 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by guest name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <div className="select-wrapper flex-1">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'registered' | 'guest')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="all">All Guests</option>
                <option value="registered">Registered Users</option>
                <option value="guest">Guest Checkout</option>
              </select>
            </div>
            <button
              onClick={() => { setShowAddModal(true); setAddError(''); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Guest</span>
            </button>
          </div>
        </div>
      </div>

      {/* Guests Grid */}
      {filteredGuests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">
            {guests.length === 0
              ? 'No guests yet. Guest profiles will appear after their first booking.'
              : 'No guests match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuests.map((guest) => (
            <div key={guest.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{guest.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      guest.type === 'registered' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {guest.type === 'registered' ? 'Registered' : 'Guest Checkout'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openDetail(guest)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="View Details"
                >
                  <Eye size={18} />
                </button>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-4 pb-4 border-b">
                {guest.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={16} className="flex-shrink-0" />
                    <a href={`mailto:${guest.email}`} className="hover:text-primary truncate">{guest.email}</a>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} className="flex-shrink-0" />
                    <a href={`tel:${guest.phone}`} className="hover:text-primary">{guest.phone}</a>
                  </div>
                )}
                {guest.country && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} className="flex-shrink-0" />
                    <span>{guest.country}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{guest.totalStays}</p>
                  <p className="text-xs text-gray-500">Stays</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">
                    {guest.totalSpent > 0 ? `LKR ${(guest.totalSpent / 1000).toFixed(0)}k` : 'LKR 0'}
                  </p>
                  <p className="text-xs text-gray-500">Spent</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">
                    {guest.lastVisit ? new Date(guest.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Last Visit</p>
                </div>
              </div>

              {/* Join Date */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={16} />
                <span>Joined {new Date(guest.joinDate).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">Total Guests</p>
          <p className="text-3xl font-bold text-primary">{guests.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">Registered Users</p>
          <p className="text-3xl font-bold text-green-600">{guests.filter(g => g.type === 'registered').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm mb-2">Total Revenue</p>
          <p className="text-3xl font-bold text-primary">LKR {totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* ── View Detail Modal ── */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Guest Details</h2>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-primary" size={36} />
                </div>
              ) : !detailData ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="mx-auto mb-2 text-red-400" size={32} />
                  <p>Failed to load guest details.</p>
                </div>
              ) : (
                <>
                  {/* Guest info card */}
                  <div className="bg-gray-50 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {detailData.guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{detailData.guest.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          detailData.guest.type === 'registered' ? 'bg-primary-light text-primary' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {detailData.guest.type === 'registered' ? 'Registered User' : 'Guest Checkout'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                      {detailData.guest.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">{detailData.guest.email}</span>
                        </div>
                      )}
                      {detailData.guest.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={15} className="text-gray-400 flex-shrink-0" />
                          <span>{detailData.guest.phone}</span>
                        </div>
                      )}
                      {detailData.guest.country && (
                        <div className="flex items-center gap-2">
                          <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                          <span>{detailData.guest.country}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-gray-400 flex-shrink-0" />
                        <span>Joined {new Date(detailData.guest.joinDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bookings table */}
                  <h4 className="font-semibold mb-3">Booking History ({detailData.bookings.length})</h4>
                  {detailData.bookings.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No bookings yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Booking Ref</th>
                            <th className="px-4 py-3 text-left">Room</th>
                            <th className="px-4 py-3 text-left">Check-in → Check-out</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detailData.bookings.map((b) => (
                            <tr key={b.bookingNumber} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.bookingNumber}</td>
                              <td className="px-4 py-3 text-gray-700">{b.room}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
                                <span className="ml-1 text-gray-400">({b.nights}n)</span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">LKR {b.amount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                                  b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  {detailData.bookings.length > 0 && (
                    <div className="flex gap-6 mt-4 pt-4 border-t text-sm">
                      <div>
                        <span className="text-gray-500">Total stays: </span>
                        <span className="font-semibold">{detailData.bookings.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total spent: </span>
                        <span className="font-semibold text-primary">
                          LKR {detailData.bookings.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end">
              <button
                onClick={closeDetail}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Guest Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Add Guest</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleAddGuest} className="p-6 space-y-4">
              {addError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {addError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.firstName}
                    onChange={(e) => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.lastName}
                    onChange={(e) => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="+94 77 000 0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={addForm.country}
                  onChange={(e) => setAddForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Sri Lanka"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addLoading && <Loader2 size={16} className="animate-spin" />}
                  {addLoading ? 'Adding…' : 'Add Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
      <GuestsContent />
    </Suspense>
  );
}
