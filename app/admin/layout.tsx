'use client';

import { AdminSidebar } from '@/components/admin/Sidebar';
import { Bell, Search, Settings, LogOut } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getAdminUser, clearAuth } from '@/lib/auth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SearchResult {
  type:     'booking' | 'guest';
  label:    string;
  sublabel: string;
  href:     string;
}

interface NotificationItem {
  label:    string;
  sublabel: string;
  href:     string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notifCount, setNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setLoading(false);
      return;
    }

    const adminUser = getAdminUser();
    if (!adminUser) {
      router.push('/admin/login');
    } else {
      setUser(adminUser);
      setLoading(false);
    }
  }, [router, pathname]);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    const fetchNotifications = () => {
      fetch('/api/admin/notifications')
        .then(res => res.json())
        .then(data => { setNotifCount(data.count || 0); setNotifItems(data.items || []); })
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [pathname]);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchDebounce.current = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(value.trim())}`)
        .then(res => res.json())
        .then(data => { setSearchResults(data.results || []); setSearchOpen(true); })
        .catch(() => {});
    }, 300);
  }

  function goToSearchResult(href: string) {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(href);
  }

  // For login page, render children without sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (loading || !user) {
    return <div className="p-6">Loading...</div>;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearAuth();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-light/10 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative">
      {/* Ambient glass background blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="fixed bottom-0 left-64 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />

      <AdminSidebar />

      <div className="lg:ml-[260px] relative">
        {/* Top Navigation */}
        <header className="glass-strong shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  placeholder="Search bookings or guests by name, email, ID"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  className="w-full pl-10 pr-4 py-2 bg-white/60 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                {searchOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 glass-strong rounded-lg shadow-lg z-40 max-h-80 overflow-y-auto animate-fadeIn">
                    {searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No matches found.</p>
                    ) : searchResults.map((r, i) => (
                      <button
                        key={i}
                        onMouseDown={() => goToSearchResult(r.href)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-between border-b last:border-b-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{r.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{r.sublabel}</p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{r.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />

              <button onClick={() => router.push('/admin/settings')} className="relative p-2 hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:bg-white/10 rounded-lg">
                <Settings size={20} className="text-gray-600 dark:text-gray-400" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotifOpen(o => !o)}
                  onBlur={() => setTimeout(() => setNotifOpen(false), 150)}
                  className="relative p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"
                >
                  <Bell size={20} className="text-gray-600 dark:text-gray-400" />
                  {notifCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute top-full right-0 mt-1 w-80 glass-strong rounded-lg shadow-lg z-40 max-h-80 overflow-y-auto animate-fadeIn">
                    {notifItems.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No new notifications.</p>
                    ) : notifItems.map((n, i) => (
                      <button
                        key={i}
                        onMouseDown={() => { setNotifOpen(false); router.push(n.href); }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/10 border-b last:border-b-0"
                      >
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{n.sublabel}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l">
                <Image
                  src="/images/avatars/admin.jpg"
                  alt={user.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold">{user.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main key={pathname} className="animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}