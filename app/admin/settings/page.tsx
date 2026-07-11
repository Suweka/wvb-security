'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, MapPin, Phone, LogOut } from 'lucide-react';
import { getAdminUser, clearAuth, type AdminUser } from '@/lib/auth';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    setUser(getAdminUser());
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuth();
      router.push('/admin/login');
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Settings</h1>
        <p className="text-gray-600">Admin account and property information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Admin Account */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Admin Account</h2>
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Role</p>
                  <p className="font-medium capitalize">{user.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <LogOut size={16} /> Log Out
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading account info…</p>
          )}
        </div>

        {/* Property Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Property Details</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="font-medium">78/5 Bakers Park, 18 Dawson Hills, Nuwara Eliya, LK</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium">+94 777 180 599</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium">whitevintagebunglow@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
