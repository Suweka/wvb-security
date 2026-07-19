'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
// usePathname reads the current URL path client-side, so we can highlight
// whichever menu item matches the page currently being viewed.
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Bed,
  Users,
  MessageSquare,
  Package,
  CalendarRange,
  DollarSign,
  Star,
  ConciergeBell,
  Settings,
  Mail,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

// Left-hand navigation sidebar shown on every page under /admin. Handles its
// own mobile open/close state and highlights the active menu item.
export const AdminSidebar = () => {
  const pathname = usePathname();
  // Whether the sidebar is expanded on mobile (it's always visible on
  // desktop via the `lg:translate-x-0` class below).
  const [isOpen, setIsOpen] = useState(false);
  // Count of unread admin messages, shown as a red badge next to "Messages".
  const [messagesUnread, setMessagesUnread] = useState(0);

  // Runs whenever the route changes: automatically closes the mobile sidebar
  // after navigating to a new page, so it doesn't stay open over the content.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Runs once on mount: fetches the unread message count from the API so the
  // badge reflects real data. Silently ignores failures (e.g. offline) since
  // this is a non-critical notification badge.
  useEffect(() => {
    fetch('/api/admin/notifications')
      .then(res => res.json())
      .then(data => setMessagesUnread(data.messagesUnread || 0))
      .catch(() => {});
  }, []);

  // List of sidebar links, each with its icon, label, target URL, and an
  // optional badge count (only "Messages" uses it, via messagesUnread above).
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Calendar, label: 'Reservation', href: '/admin/reservations' },
    { icon: Bed, label: 'Rooms', href: '/admin/rooms' },
    { icon: Users, label: 'Guests', href: '/admin/guests' },
    { icon: MessageSquare, label: 'Messages', href: '/admin/messages', badge: messagesUnread || undefined },
    { icon: Package, label: 'Housekeeping', href: '/admin/housekeeping' },
    { icon: CalendarRange, label: 'Calendar', href: '/admin/calendar' },
    { icon: DollarSign, label: 'Financials', href: '/admin/financials' },
    { icon: Star, label: 'Reviews', href: '/admin/reviews' },
    { icon: ConciergeBell, label: 'Concierge', href: '/admin/concierge' },
    { icon: Mail, label: 'Newsletter', href: '/admin/newsletter' },
    { icon: ShieldCheck, label: 'Audit Log', href: '/admin/audit-log' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  return (
    <>
      {/* Mobile Menu Button — only visible below the lg breakpoint */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay — dims the page behind the sidebar on mobile; clicking it closes the sidebar */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar — slides on/off screen on mobile via translate-x classes,
          always docked open on large screens (lg:translate-x-0) */}
      <aside
        className={`fixed left-0 top-0 h-full glass-strong shadow-2xl z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ width: '260px' }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/50">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white font-bold text-xl">L</span>
            </div>
            <div>
              <h1 className="text-lg font-heading font-bold text-gray-900 dark:text-gray-100">Lodgify</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">V1.0</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 96px)' }}>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              // Highlight this link if its href matches the current page's path.
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/10 hover:translate-x-0.5'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <item.icon size={20} />
                    <span className="flex-1">{item.label}</span>
                    {/* Red unread-count badge, only rendered when there's a nonzero count */}
                    {item.badge && (
                      <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};
