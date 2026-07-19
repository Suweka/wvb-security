// Admin page — Coupons.
// Lists all discount coupons, lets staff create a new one, toggle a coupon
// active/inactive, or delete it. Talks to /api/admin/coupons and
// /api/admin/coupons/[id]. Guests redeem these codes at checkout via
// /api/coupons/validate (see app/(guest)/booking/page.tsx).
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Trash2, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react';

// Shape of a coupon row as returned by the API (dates arrive as ISO strings over JSON).
interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  usageCount: number;
  maxUsage: number | null;
  createdAt: string;
}

// Shape of the "New Coupon" modal form fields.
interface NewCouponForm {
  code: string;
  discountPercent: string;
  validFrom: string;
  validUntil: string;
  maxUsage: string;
}

const EMPTY_FORM: NewCouponForm = { code: '', discountPercent: '', validFrom: '', validUntil: '', maxUsage: '' };

// Works out a human status label from a coupon's active flag + dates —
// this is purely a display computation, nothing is stored as "expired" in the DB.
function getStatus(coupon: Coupon): { label: string; className: string } {
  if (!coupon.isActive) return { label: 'Inactive', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
  if (new Date(coupon.validUntil) < new Date()) return { label: 'Expired', className: 'bg-red-100 text-red-700' };
  if (new Date(coupon.validFrom) > new Date()) return { label: 'Upcoming', className: 'bg-blue-100 text-blue-700' };
  if (coupon.maxUsage != null && coupon.usageCount >= coupon.maxUsage) return { label: 'Used up', className: 'bg-orange-100 text-orange-700' };
  return { label: 'Active', className: 'bg-green-100 text-green-700' };
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Main page component — rendered at /admin/coupons.
export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New coupon modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<NewCouponForm>(EMPTY_FORM);
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState('');

  // Loads the full coupon list.
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/coupons');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  // Flips a coupon's isActive flag via PATCH, then merges the response
  // back into local state rather than refetching the whole list.
  async function handleToggleActive(coupon: Coupon) {
    setTogglingId(coupon.id);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCoupons(prev => prev.map(c => c.id === coupon.id ? data.coupon : c));
    } catch {
      // Silently ignored — the switch will just visually stay in its old state.
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Failed to delete coupon. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.code.trim() || !newForm.discountPercent || !newForm.validFrom || !newForm.validUntil) {
      setNewError('Please fill in code, discount, and both dates.');
      return;
    }
    setNewLoading(true);
    setNewError('');
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newForm.code,
          discountPercent: Number(newForm.discountPercent),
          validFrom: newForm.validFrom,
          validUntil: newForm.validUntil,
          maxUsage: newForm.maxUsage || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNewError(data.error || 'Failed to create coupon.'); return; }
      setCoupons(prev => [data.coupon, ...prev]);
      setShowNew(false);
      setNewForm(EMPTY_FORM);
    } catch {
      setNewError('Network error. Please try again.');
    } finally {
      setNewLoading(false);
    }
  }

  const activeCount = coupons.filter(c => getStatus(c).label === 'Active').length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load coupons.</p>
      <button onClick={fetchCoupons} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Coupons</h1>
          <p className="text-gray-500 dark:text-gray-400">{coupons.length} total &middot; {activeCount} currently active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCoupons} className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { setNewForm(EMPTY_FORM); setNewError(''); setShowNew(true); }}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <Plus size={20} /> New Coupon
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Code</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Discount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Valid Period</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Usage</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No coupons yet. Create one to offer a discount at checkout.
                </td></tr>
              ) : coupons.map((coupon) => {
                const status = getStatus(coupon);
                return (
                  <tr key={coupon.id} className="border-b hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-primary text-sm tracking-wider">{coupon.code}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{coupon.discountPercent}% off</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {fmtDate(coupon.validFrom)} – {fmtDate(coupon.validUntil)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {coupon.usageCount}{coupon.maxUsage != null ? ` / ${coupon.maxUsage}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Active/inactive toggle switch */}
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          disabled={togglingId === coupon.id}
                          title={coupon.isActive ? 'Deactivate' : 'Activate'}
                          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${coupon.isActive ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${coupon.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          disabled={deletingId === coupon.id}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === coupon.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Coupon modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Tag className="text-primary" size={20} />
                <h2 className="text-xl font-bold">New Coupon</h2>
              </div>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {newError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" /> {newError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
                <input
                  type="text"
                  value={newForm.code}
                  onChange={e => setNewForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AUGUST20"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm uppercase tracking-wider"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount % *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newForm.discountPercent}
                  onChange={e => setNewForm(f => ({ ...f, discountPercent: e.target.value }))}
                  placeholder="20"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid From *</label>
                  <input
                    type="date"
                    value={newForm.validFrom}
                    onChange={e => setNewForm(f => ({ ...f, validFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valid Until *</label>
                  <input
                    type="date"
                    value={newForm.validUntil}
                    onChange={e => setNewForm(f => ({ ...f, validUntil: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Uses (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={newForm.maxUsage}
                  onChange={e => setNewForm(f => ({ ...f, maxUsage: e.target.value }))}
                  placeholder="Leave blank for unlimited"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={newLoading} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {newLoading ? <Loader2 size={16} className="animate-spin" /> : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
