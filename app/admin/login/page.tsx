// Admin page — Login.
// Two-step sign-in: email/password first, then a 6-digit code emailed to
// the admin (MFA). Step 1 posts to /api/auth/login, which — on a correct
// password — emails a code and sets a short-lived "pending" cookie instead
// of a real session. Step 2 posts the code to /api/auth/verify-mfa, which
// sets the actual secure httpOnly session cookie on success; this page then
// caches the (non-sensitive) user profile locally and redirects to
// /admin/dashboard.
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Reveal } from '@/components/guest/Reveal';
import { Magnetic } from '@/components/ui/Magnetic';
import { setAdminUser } from '@/lib/auth';

const RESEND_COOLDOWN_SECONDS = 60;

// Main page component — rendered at /admin/login.
export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Toggles whether the password field shows plain text or dots.
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');

  // Ticks the resend cooldown down to 0 once a second.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Handles the password form submission: POSTs credentials to the API. On
  // success the API doesn't log us in yet — it emails a code and tells us
  // to move to the code step.
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    // Stop the browser from doing its default full-page form submission.
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      setStep('code');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Handles the verification-code submission. On success the real session
  // cookie is already set by the API — we just cache the profile and go.
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Verification failed. Please try again.');
        setLoading(false);
        return;
      }

      // The real session token is already set as an httpOnly cookie by the API route.
      // We only cache the (non-sensitive) profile info here for the admin UI to display.
      setAdminUser(data.user);

      router.push('/admin/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Requests a fresh code, subject to the same 60s cooldown the server enforces.
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendMsg('');
    setError('');
    try {
      const response = await fetch('/api/auth/resend-mfa-code', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Could not resend code.');
        return;
      }
      setResendMsg('A new code has been sent.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError('An error occurred. Please try again.');
    }
  };

  // Returns to the password step (e.g. wrong email, or the code expired).
  const handleBack = () => {
    setStep('password');
    setPassword('');
    setCode('');
    setError('');
    setResendMsg('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glass blobs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-slow pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo Section */}
        <Reveal>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 glass-strong rounded-full mb-4">
              <span className="text-3xl font-bold text-primary">L</span>
            </div>
            <h1 className="text-4xl font-heading font-bold text-white mb-2">Lodgify</h1>
            <p className="text-gray-200">Hotel Management Platform</p>
          </div>
        </Reveal>

        {/* Login Card */}
        <Reveal delay={0.1} className="glass-strong rounded-2xl shadow-2xl p-8">
          {step === 'password' ? (
            <>
              <h2 className="text-2xl font-heading font-bold mb-2 text-gray-900 dark:text-gray-100">Admin Login</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Enter your credentials to access the dashboard</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="suwekasansiluni@gmail.com"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 border border-gray-300 dark:border-gray-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-primary hover:underline font-medium">
                    Forgot password?
                  </a>
                </div>

                {/* Login Button */}
                <Magnetic strength={0.25}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-primary to-primary-dark hover:shadow-lg hover:shadow-primary/40 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </Magnetic>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                type="button"
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary mb-4"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-gray-100">Verify It's You</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We emailed a 6-digit code to <strong>{email}</strong>. Enter it below — it expires in 10 minutes.
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {resendMsg && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  {resendMsg}
                </div>
              )}

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-2xl tracking-[0.5em] font-bold"
                    placeholder="000000"
                  />
                </div>

                <Magnetic strength={0.25}>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full bg-gradient-to-r from-primary to-primary-dark hover:shadow-lg hover:shadow-primary/40 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </Magnetic>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="w-full text-sm text-primary hover:underline disabled:text-gray-400 dark:disabled:text-gray-500 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </form>
            </>
          )}
        </Reveal>

        {/* Footer */}
        <p className="text-center text-gray-300 text-sm mt-6">
          © 2024 Lodgify. All rights reserved.
        </p>
      </div>
    </div>
  );
}
