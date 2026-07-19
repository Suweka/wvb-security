// Admin page — Login layout.
// A pass-through layout for the /admin/login route: it renders `children`
// (the login page) with no extra wrapper markup. This exists because the
// parent app/admin/layout.tsx normally wraps every /admin/* page with the
// sidebar and header, but the login page needs to render on its own instead
// (that parent layout special-cases pathname === '/admin/login' to skip its
// chrome too — this file is a second layer of the same opt-out).
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
