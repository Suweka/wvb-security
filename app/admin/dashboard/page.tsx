// Admin page — Dashboard (the /admin landing page).
// Shows an overview of the hotel's current state: booking stat cards, room
// availability, revenue snapshot, recent reservations table, and active
// tasks. Also acts as a client-side auth gate — redirects to /admin/login
// if no admin session is found in local storage.
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import { getDashboardStats } from '@/lib/admin-actions';
import { Reveal, Stagger } from '@/components/guest/Reveal';
import { CountUp } from '@/components/guest/CountUp';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bed,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';

// Main page component — rendered at /admin/dashboard.
export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Holds the full dashboard payload (stats, room stats, recent bookings,
  // tasks) once fetched — typed loosely as `any` since it's a big combined
  // object from the server action.
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  // Runs once when the page mounts: checks if an admin is "logged in"
  // (cached in local storage by lib/auth), and if not, redirects to the
  // login page. If logged in, kicks off the dashboard data fetch.
  useEffect(() => {
    const adminUser = getAdminUser();
    if (!adminUser) {
      router.push('/admin/login');
    } else {
      setUser(adminUser);
      fetchDashboardData();
    }
  }, [router]);

  // Fetches all the numbers/lists the dashboard needs in one call.
  async function fetchDashboardData() {
    setLoading(true);
    setError(false);
    const stats = await getDashboardStats();
    if (stats) {
      setData(stats);
    } else {
      setError(true);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-600 dark:text-gray-400">Failed to load dashboard data.</p>
        <button
          onClick={fetchDashboardData}
          className="text-sm bg-white border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    );
  }

  // Destructure the combined dashboard payload into its parts for readability.
  const { stats, roomStats, recentBookings, tasks } = data;

  // Configuration for the four top stat cards — pairs each metric with its
  // icon, color, and label so the JSX below can just .map() over this list.
  const statCards = [
    {
      title: 'Confirmed Bookings',
      value: stats.confirmedBookings,
      numeric: stats.confirmedBookings,
      change: 'Active',
      trend: 'up',
      subtitle: 'Successfully booked',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Pending Bookings',
      value: stats.pendingBookings,
      numeric: stats.pendingBookings,
      change: 'Action Required',
      trend: 'down',
      subtitle: 'Awaiting confirmation',
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      title: 'Cancelled',
      value: stats.cancelledBookings,
      numeric: stats.cancelledBookings,
      change: 'Lost',
      trend: 'down',
      subtitle: 'Total cancelled',
      icon: XCircle,
      color: 'bg-red-100 text-red-600',
    },
    {
      title: 'Total Revenue',
      value: `LKR ${Number(stats.revenue).toLocaleString()}`,
      numeric: null,
      change: 'Gross',
      trend: 'up',
      subtitle: 'From paid bookings',
      icon: DollarSign,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  // Static placeholder data for the "Distribution" chart — this site only
  // takes direct bookings (no third-party platforms like Booking.com yet),
  // so it's hardcoded to 100%.
  const bookingPlatforms = [
    { name: 'Direct Booking', percentage: 100, color: 'bg-primary' },
  ];

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <Reveal>
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening today.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="text-sm glass-card px-4 py-2 rounded-lg hover:bg-white/90 transition-all hover:-translate-y-0.5 flex items-center gap-2"
          >
            <Clock size={16} />
            Refresh Data
          </button>
        </div>
      </Reveal>

      {/* Stats Grid */}
      <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="glass-card hover-lift rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.title}</div>
            <div className="text-2xl font-bold mb-1">
              {stat.numeric !== null ? <CountUp end={stat.numeric} /> : stat.value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{stat.subtitle}</div>
          </div>
        ))}
      </Stagger>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Room Availability */}
        <Reveal delay={0.05} className="glass-card hover-lift rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Room Availability</h3>
            <button className="text-sm text-primary hover:underline">View All</button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Rooms</span>
                <span className="font-semibold">{roomStats.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Available Rooms</span>
                <span className="font-semibold text-green-600">{roomStats.available}</span>
              </div>
              {/* Bar width is the available/total percentage; guarded against
                  divide-by-zero when there are no rooms yet. */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: roomStats.total > 0 ? `${(roomStats.available / roomStats.total) * 100}%` : '0%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Booked Rooms</span>
                <span className="font-semibold text-blue-600">{roomStats.booked}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: roomStats.total > 0 ? `${(roomStats.booked / roomStats.total) * 100}%` : '0%' }}></div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Revenue Status */}
        <Reveal delay={0.1} className="glass-card hover-lift rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Revenue Status</h3>
          </div>
          <div className="text-center py-8">
             {/* Revenue divided by 1000 and shown with a "k" suffix (e.g.
                 250.5k instead of 250500) so the number is easy to scan.
                 CountUp animates from 0 up to this value on render. */}
             <div className="text-4xl font-bold text-primary mb-2">
               <CountUp end={Number(stats.revenue / 1000)} decimals={1} suffix="k" />
             </div>
             <div className="text-gray-500 dark:text-gray-400 text-sm">Total LKR Revenue</div>
             <div className="mt-6 flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-green-600 font-bold">{stats.confirmedBookings}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-600 font-bold">{stats.pendingBookings}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Unpaid</div>
                </div>
             </div>
          </div>
        </Reveal>

        {/* Booking Platforms */}
        <Reveal delay={0.15} className="glass-card hover-lift rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Distribution</h3>
          </div>
          <div className="space-y-4">
            {bookingPlatforms.map((platform, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{platform.name}</span>
                  <span className="font-semibold">{platform.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${platform.color} h-2 rounded-full transition-all duration-700`}
                    style={{ width: `${platform.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              All bookings are currently managed through the internal system.
            </p>
          </div>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reservations */}
        <Reveal className="lg:col-span-2 glass-card hover-lift rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Reservations</h3>
            <button className="text-sm text-primary hover:underline">View All</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600 dark:text-gray-400 border-b">
                  <th className="pb-3">Guest</th>
                  <th className="pb-3">Room</th>
                  <th className="pb-3">Check-in</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.length > 0 ? recentBookings.map((booking: any) => (
                  <tr key={booking.id} className="border-b last:border-0 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                    <td className="py-4">
                      <span className="font-medium">{booking.guest}</span>
                    </td>
                    <td className="py-4 text-sm text-gray-600 dark:text-gray-400">{booking.room}</td>
                    <td className="py-4 text-sm text-gray-600 dark:text-gray-400">{booking.checkIn}</td>
                    <td className="py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : booking.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-4 font-semibold">LKR {booking.amount.toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No recent bookings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Tasks */}
        <Reveal delay={0.05} className="glass-card hover-lift rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Active Tasks</h3>
            <button className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark text-white rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-110">
              +
            </button>
          </div>

          <Stagger className="space-y-4">
            {tasks.length > 0 ? tasks.map((task: any) => (
              <div
                key={task.id}
                className={`p-4 rounded-lg border-l-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  task.priority === 'high'
                    ? 'bg-red-50/80 border-red-500'
                    : task.priority === 'medium'
                    ? 'bg-yellow-50/80 border-yellow-500'
                    : 'bg-green-50/80 border-green-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm">{task.title}</h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <Clock size={12} />
                  <span>{task.time}</span>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 italic">
                No active tasks.
              </div>
            )}
          </Stagger>
        </Reveal>
      </div>
    </div>
  );
}