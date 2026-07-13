'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getCalendarData } from '@/lib/admin-actions';

interface CalendarBooking {
  id: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'pending';
}

function getDatesInRange(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkIn);
  const end   = new Date(checkOut);
  const cur   = new Date(start);
  while (cur < end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth());
  });
  const [bookings, setBookings]   = useState<CalendarBooking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(false);
    const data = await getCalendarData();
    if (data) setBookings(data);
    else setError(true);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();

  const days: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build date → bookings map for this month
  const dateMap: Record<string, CalendarBooking[]> = {};
  for (const b of bookings) {
    for (const d of getDatesInRange(b.checkIn, b.checkOut)) {
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(b);
    }
  }

  // Upcoming: check-ins from today
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = bookings
    .filter(b => b.checkIn >= todayStr)
    .slice(0, 8);

  const eventColors = ['border-blue-500 bg-blue-50', 'border-green-500 bg-green-50', 'border-purple-500 bg-purple-50', 'border-orange-500 bg-orange-50'];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <AlertCircle className="text-red-500" size={40} />
      <p className="text-gray-600 dark:text-gray-400">Failed to load calendar data.</p>
      <button onClick={fetchBookings} className="px-4 py-2 bg-primary text-white rounded-lg">Retry</button>
    </div>
  );

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Calendar</h1>
          <p className="text-gray-600 dark:text-gray-400">View bookings and check-in/check-out events</p>
        </div>
        <button onClick={fetchBookings} className="text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 glass-card hover-lift rounded-2xl p-6">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-heading font-bold">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center font-semibold text-gray-600 dark:text-gray-400 py-2 text-sm">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => {
              if (!date) return <div key={i} />;
              const dateStr  = date.toISOString().split('T')[0];
              const dayBooks = dateMap[dateStr] ?? [];
              const isToday  = dateStr === todayStr;

              return (
                <div
                  key={i}
                  className={`min-h-[72px] p-1.5 rounded-lg border-2 transition-all ${
                    isToday
                      ? 'border-primary bg-primary-light'
                      : dayBooks.length > 0
                      ? 'border-accent bg-accent-light'
                      : 'border-gray-100 bg-white hover:border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                    {date.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayBooks.slice(0, 2).map(b => (
                      <p key={b.id} title={`${b.guestName} — ${b.room}`}
                        className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded truncate leading-tight">
                        {b.room}
                      </p>
                    ))}
                    {dayBooks.length > 2 && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">+{dayBooks.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary rounded bg-primary-light" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent rounded bg-accent-light" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Booking</span>
            </div>
          </div>
        </div>

        {/* Upcoming Check-ins */}
        <div className="lg:col-span-1">
          <div className="glass-card hover-lift rounded-2xl p-6 sticky top-24">
            <h3 className="text-lg font-semibold mb-4">Upcoming Check-ins</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming bookings.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b, i) => (
                  <div
                    key={b.id}
                    className={`p-3 rounded-lg border-l-4 ${eventColors[i % eventColors.length]}`}
                  >
                    <p className="font-semibold text-xs text-gray-800 dark:text-gray-200">{b.checkIn}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 truncate">{b.guestName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.room}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                      b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
