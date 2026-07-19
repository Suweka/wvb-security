// Admin page — Settings.
// Two panels: the logged-in admin's account info (with a photo upload) and
// logout button, plus static read-only property contact details.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, MapPin, Phone, LogOut, Camera, Loader2 } from 'lucide-react';
import { getAdminUser, setAdminUser, clearAuth, type AdminUser } from '@/lib/auth';

// Uploads the admin's chosen profile photo directly from the browser to
// Cloudinary (an image-hosting service), using a signed upload: our server
// first hands out a short-lived signature, then the browser uploads the
// file straight to Cloudinary's API. Returns the final hosted image URL.
async function uploadAvatarToCloudinary(file: File): Promise<string> {
  const sigRes = await fetch('/api/upload/signature?folder=admin-avatars');
  if (!sigRes.ok) throw new Error('Could not get upload signature');
  const { signature, timestamp, folder, cloudName, apiKey } = await sigRes.json();

  const form = new FormData();
  form.append('file', file);
  form.append('signature', signature);
  form.append('timestamp', String(timestamp));
  form.append('api_key', apiKey);
  form.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!uploadRes.ok) throw new Error('Image upload failed');
  const data = await uploadRes.json();
  return data.secure_url as string;
}

// Main page component — rendered at /admin/settings.
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Ref to the hidden <input type="file"> so we can trigger the native file
  // picker programmatically from the camera icon / "Change photo" link.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Runs once on mount: loads the cached admin user (from local storage),
  // then fetches the latest profile from the server in case the avatar
  // changed since it was cached.
  useEffect(() => {
    const stored = getAdminUser();
    setUser(stored);
    if (stored?.email) {
      fetch(`/api/admin/profile?email=${encodeURIComponent(stored.email)}`)
        .then(res => res.json())
        .then(data => {
          if (data.avatarUrl) setUser(u => (u ? { ...u, avatarUrl: data.avatarUrl } : u));
        })
        .catch(() => {});
    }
  }, []);

  // Fires when the admin picks a new profile photo. Uploads it to
  // Cloudinary, saves the resulting URL to the server, and updates both
  // local component state and the cached user (so the sidebar/header avatar
  // updates immediately too).
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file still triggers this handler.
    e.target.value = '';
    if (!file || !user) return;

    setUploadError('');
    setUploading(true);
    try {
      const avatarUrl = await uploadAvatarToCloudinary(file);
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, avatarUrl }),
      });
      if (!res.ok) throw new Error('Failed to save photo');

      const updatedUser = { ...user, avatarUrl };
      setUser(updatedUser);
      setAdminUser(updatedUser);
    } catch {
      setUploadError('Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Logs the admin out: clears the server session cookie, clears the
  // locally cached user, and redirects to the login page.
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuth();
      router.push('/admin/login');
    }
  };

  return (
    <div className="p-6 min-h-screen animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Admin account and property information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Admin Account */}
        <div className="glass-card hover-lift rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Admin Account</h2>
          {user ? (
            <div className="space-y-4">
              {/* Profile Photo */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-white/70"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xl font-bold">
                      {user.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    title="Change photo"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {uploading ? 'Uploading…' : 'Change photo'}
                  </button>
                  {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading account info…</p>
          )}
        </div>

        {/* Property Details */}
        <div className="glass-card hover-lift rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Property Details</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                <p className="font-medium">78/5 Bakers Park, 18 Dawson Hills, Nuwara Eliya, LK</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-medium">+94 777 180 599</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="text-primary flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium">whitevintagebunglow@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
