// Client-side helpers for the admin UI to remember which admin is "logged in"
// so pages can display a name/avatar etc. This is purely for UI convenience —
// see the big comment below for why it grants no real access by itself.
// (Actual request-level security is enforced server-side by lib/admin-auth.ts.)

// Shape of the cached admin profile info stored in the browser.
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

// The real auth token lives only in an httpOnly cookie (set by /api/auth/login) —
// it is never exposed to JS, so it can't be read by an XSS payload. `adminUser` here
// is just cached profile info for the UI; it grants no access on its own since every
// /api/admin/* route independently verifies the cookie via lib/admin-auth.ts.

// Reads the cached admin profile from localStorage (browser-only storage).
// Returns null during server-side rendering (no `window`) or if nothing is stored.
export const getAdminUser = (): AdminUser | null => {
  if (typeof window === 'undefined') return null; // guards against running during SSR, where there is no browser/localStorage
  const user = localStorage.getItem('adminUser');
  return user ? JSON.parse(user) : null;
};

// Saves the admin's profile info to localStorage after a successful login, so
// the UI can display it without re-fetching on every page.
export const setAdminUser = (user: AdminUser): void => {
  localStorage.setItem('adminUser', JSON.stringify(user));
};

// Removes the cached profile info, e.g. on logout. Note: this does NOT clear
// the actual httpOnly auth cookie — that must be cleared by a server request.
export const clearAuth = (): void => {
  localStorage.removeItem('adminUser');
};

// Convenience check: "is there a cached admin profile?" Used only to decide
// what the UI shows — never treat this as a real permission check.
export const isAuthenticated = (): boolean => {
  return !!getAdminUser();
};
