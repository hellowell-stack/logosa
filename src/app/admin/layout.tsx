import type { Metadata } from "next";

/**
 * The admin's outer frame. No public navigation, no footer, no smooth scroll —
 * and nothing here is ever indexed. The signed-in shell with the sidebar is in
 * `(panel)/layout.tsx`; sign-in and first-run setup sit outside it.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Logosa admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-paper text-ink">{children}</div>;
}
