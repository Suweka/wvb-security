// Admin page — Pricing.
// A booking.com-style rate calendar: pick a room and a currency, see a
// month grid of nightly prices (an admin-set override, or the room's base
// rate shown muted), click a date to edit it, or use Bulk Edit to set a
// whole date range at once. Calendar grid mirrors app/admin/calendar/page.tsx.
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, X, Trash2 } from 'lucide-react';
import { getRoomsData } from '@/lib/admin-actions';
import { StyledSelect } from '@/components/ui/StyledSelect';
import { SUPPORTED_CURRENCIES, MARKETS, Market } from '@/lib/currency';
import { formatCurrency } from '@/lib/utils';

interface RoomOption {
  id: string;
  name: string;
}

interface DailyRateRow {
  date: string; // "YYYY-MM-DD"
  price: number;
}

// Currencies the admin can set a conversion rate for (all supported
// currencies except LKR, which is the base everything else converts from).
const CONVERTIBLE_CURRENCIES = SUPPORTED_CURRENCIES.filter(c => c !== 'LKR');

// "YYYY-MM-DD" from local date parts — same convention used everywhere else
// (lib/pricing.ts's dateKey, the booking flow's toKey).
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get('room');

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [currency, setCurrency] = useState<string>('LKR');
  const [market, setMarket] = useState<Market>('LOCAL');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth());
  });

  const [basePrice, setBasePrice] = useState(0);
  const [rates, setRates] = useState<DailyRateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Edit modal: startDate/endDate/price. Opened either from a single cell
  // click (startDate === endDate, prefilled) or the "Bulk Edit" button
  // (blank, admin fills in the range).
  const [editModal, setEditModal] = useState<{ startDate: string; endDate: string; price: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Exchange rates panel: "1 [currency] = ___ LKR" inputs, used to
  // auto-convert a room's LKR price wherever no explicit per-date price
  // override exists for that currency (see lib/pricing.ts's
  // resolveNightlyRate). Kept as strings while editing, same pattern as
  // the room admin form.
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingRate, setSavingRate] = useState<string | null>(null);
  const [rateMsg, setRateMsg] = useState('');

  const fetchExchangeRates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/exchange-rates');
      if (!res.ok) throw new Error();
      const data: { currency: string; rateToLKR: number }[] = await res.json();
      const inputs: Record<string, string> = {};
      for (const r of data) inputs[r.currency] = String(r.rateToLKR);
      setRateInputs(inputs);
    } catch {
      // Non-fatal — the panel just shows blank inputs until retried.
    }
  }, []);

  useEffect(() => { fetchExchangeRates(); }, [fetchExchangeRates]);

  async function handleSaveRate(currencyCode: string) {
    const value = rateInputs[currencyCode];
    if (!value || Number(value) <= 0) return;
    setSavingRate(currencyCode);
    setRateMsg('');
    try {
      const res = await fetch('/api/admin/exchange-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: currencyCode, rateToLKR: Number(value) }),
      });
      if (!res.ok) throw new Error();
      setRateMsg(`${currencyCode} rate updated.`);
    } catch {
      setRateMsg(`Failed to update the ${currencyCode} rate.`);
    } finally {
      setSavingRate(null);
    }
  }

  // Load the room list once on mount.
  useEffect(() => {
    getRoomsData().then(data => {
      if (data) {
        setRooms(data.map(r => ({ id: r.id, name: r.name })));
        // Preselect the room passed via ?room= (e.g. the "Pricing" link on
        // /admin/rooms), falling back to the first room in the list.
        const preselect = roomParam && data.some(r => r.id === roomParam) ? roomParam : data[0]?.id;
        if (preselect) setSelectedRoomId(preselect);
      }
      setRoomsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const fetchRates = useCallback(async () => {
    if (!selectedRoomId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/pricing?roomId=${selectedRoomId}&currency=${currency}&market=${market}&month=${monthKey}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBasePrice(data.basePrice);
      setRates(data.rates);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRoomId, currency, market, monthKey]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const rateByDate = new Map(rates.map(r => [r.date, r.price]));

  // What a date with NO explicit override displays (and prefills in the edit
  // modal) for the selected currency tab: the LKR base price for the LKR
  // tab; for other currencies, the base price converted via the exchange
  // rate above — mirroring exactly what a guest browsing in that currency
  // sees (lib/pricing.ts's resolveNightlyRate). If no rate is configured,
  // guests see the raw LKR price, so the calendar shows that too.
  // Only meaningful for the LOCAL market — FOREIGN has no base rate of its
  // own; a date with no foreign override just falls back to whatever LOCAL
  // resolves to (shown as a plain "Local rate applies" note instead, since
  // computing that exact number here would mean also fetching LOCAL rates).
  const exchangeRate = currency !== 'LKR' ? parseFloat(rateInputs[currency] ?? '') : null;
  const fallbackPrice =
    currency === 'LKR' || !exchangeRate || exchangeRate <= 0
      ? basePrice
      : Math.round((basePrice / exchangeRate) * 100) / 100;
  const fallbackCurrency = currency === 'LKR' || !exchangeRate || exchangeRate <= 0 ? 'LKR' : currency;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = dateKey(new Date());

  function openCellEdit(date: Date) {
    const key = dateKey(date);
    const existing = rateByDate.get(key);
    // For FOREIGN, there's no single fallback number to prefill with (it
    // depends on LOCAL's own resolution) — leave it blank for a fresh entry.
    const prefill = existing != null ? String(existing) : market === 'LOCAL' ? String(fallbackPrice) : '';
    setEditModal({ startDate: key, endDate: key, price: prefill });
    setActionMsg('');
  }

  function openBulkEdit() {
    setEditModal({ startDate: '', endDate: '', price: '' });
    setActionMsg('');
  }

  async function handleSave() {
    if (!editModal || !selectedRoomId || !editModal.startDate || !editModal.endDate || !editModal.price) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoomId,
          currency,
          market,
          startDate: editModal.startDate,
          endDate: editModal.endDate,
          price: parseFloat(editModal.price),
        }),
      });
      if (!res.ok) throw new Error();
      setEditModal(null);
      setActionMsg('Pricing updated.');
      await fetchRates();
    } catch {
      setActionMsg('Failed to save pricing.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!editModal || !selectedRoomId || !editModal.startDate || !editModal.endDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoomId,
          currency,
          market,
          startDate: editModal.startDate,
          endDate: editModal.endDate,
        }),
      });
      if (!res.ok) throw new Error();
      setEditModal(null);
      setActionMsg('Reverted to base price.');
      await fetchRates();
    } catch {
      setActionMsg('Failed to clear pricing.');
    } finally {
      setSaving(false);
    }
  }

  const currencyOptions = SUPPORTED_CURRENCIES.map(c => ({ value: c, label: c }));
  const roomOptions = rooms.map(r => ({ value: r.id, label: r.name }));

  if (roomsLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Pricing</h1>
          <p className="text-gray-600 dark:text-gray-400">Set seasonal and per-currency prices for individual dates</p>
        </div>
        <button onClick={fetchRates} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
          {actionMsg}
        </div>
      )}

      {/* Exchange Rates — used to auto-convert a room's LKR price into
          another currency wherever no explicit per-date price is set for
          it below. */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-semibold mb-1">Exchange Rates</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Guests browsing in a currency with no custom price for a given date see the LKR price converted using these rates instead.
        </p>
        {rateMsg && <p className="text-xs text-green-700 mb-3">{rateMsg}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CONVERTIBLE_CURRENCIES.map(code => (
            <div key={code}>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">1 {code} =</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 334.50"
                  value={rateInputs[code] ?? ''}
                  onChange={e => setRateInputs({ ...rateInputs, [code]: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => handleSaveRate(code)}
                  disabled={savingRate === code || !rateInputs[code]}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm flex items-center justify-center min-w-[64px]"
                >
                  {savingRate === code ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                </button>
              </div>
              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-1">LKR</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls. `relative z-20` lifts this card's stacking context above
          the calendar card below — both use backdrop-blur (which creates its
          own stacking context), so without this the calendar paints over the
          open room/currency dropdown lists and hides most of their options. */}
      <div className="glass-card hover-lift rounded-2xl p-6 mb-6 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
            <StyledSelect value={selectedRoomId} onChange={setSelectedRoomId} options={roomOptions} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <StyledSelect value={currency} onChange={setCurrency} options={currencyOptions} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Market</label>
            <StyledSelect
              value={market}
              onChange={(v) => setMarket(v as Market)}
              options={MARKETS.map(m => ({ value: m, label: m === 'LOCAL' ? 'Local' : 'Foreign' }))}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={openBulkEdit}
              disabled={!selectedRoomId}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              Bulk Edit Range
            </button>
          </div>
        </div>
        {market === 'FOREIGN' ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            A date with no foreign price set here falls back to whatever the Local market resolves to for that date — not a separate base rate.
          </p>
        ) : currency !== 'LKR' && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            A date with no {currency} price set is shown converted from LKR using the exchange rate above (or the raw LKR price if no rate is set).
          </p>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 glass-card rounded-2xl">
          <AlertCircle className="text-red-500" size={40} />
          <p className="text-gray-600 dark:text-gray-400">Failed to load the pricing calendar.</p>
          <button onClick={fetchRates} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
        </div>
      ) : (
        <div className="glass-card hover-lift rounded-2xl p-6 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 rounded-2xl flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-heading font-bold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center font-semibold text-gray-600 dark:text-gray-400 py-2 text-sm">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = dateKey(date);
              const override = rateByDate.get(key);
              const isToday = key === todayStr;
              const hasOverride = override != null;

              return (
                <button
                  key={i}
                  onClick={() => openCellEdit(date)}
                  className={`min-h-[64px] p-1.5 rounded-lg border-2 text-left transition-all ${
                    isToday
                      ? 'border-primary bg-primary-light'
                      : hasOverride
                      ? 'border-accent bg-accent-light'
                      : 'border-gray-100 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                    {date.getDate()}
                  </p>
                  <p className={`text-[11px] leading-tight truncate ${hasOverride ? 'font-semibold text-gray-900 dark:text-gray-100' : 'italic text-gray-400 dark:text-gray-500'}`}>
                    {hasOverride
                      ? formatCurrency(override, currency)
                      : market === 'FOREIGN'
                      ? 'Local rate'
                      : formatCurrency(fallbackPrice, fallbackCurrency)}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary rounded bg-primary-light" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent rounded bg-accent-light" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Custom price set</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-100 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {market === 'FOREIGN' ? (
                  'No custom price — Local market rate applies'
                ) : (
                  <>
                    Base price ({formatCurrency(basePrice, 'LKR')}
                    {fallbackCurrency !== 'LKR' && <> &asymp; {formatCurrency(fallbackPrice, fallbackCurrency)}</>})
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — used for both a single-date click and Bulk Edit */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-heading font-bold">Edit Price</h2>
              <button onClick={() => setEditModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editModal.startDate}
                    onChange={e => setEditModal({ ...editModal, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editModal.endDate}
                    onChange={e => setEditModal({ ...editModal, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price ({currency})</label>
                <input
                  type="number"
                  min="0"
                  value={editModal.price}
                  onChange={e => setEditModal({ ...editModal, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={handleClear}
                disabled={saving || !editModal.startDate || !editModal.endDate}
                title="Remove any custom price in this range, reverting to the base price"
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={14} /> Clear
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editModal.startDate || !editModal.endDate || !editModal.price}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams() (for the ?room= preselect) requires a Suspense boundary
// above it in the App Router.
export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  );
}
