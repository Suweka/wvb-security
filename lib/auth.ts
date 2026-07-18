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
export const getAdminUser = (): AdminUser | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('adminUser');
  return user ? JSON.parse(user) : null;
};

export const setAdminUser = (user: AdminUser): void => {
  localStorage.setItem('adminUser', JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem('adminUser');
};

export const isAuthenticated = (): boolean => {
  return !!getAdminUser();
};
