import Image from "next/image";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { requireStaff } from "@/lib/auth/session";
import { countNewEnquiries } from "@/lib/bookings/service";
import { logout } from "@/app/admin/_actions/auth";

/**
 * The signed-in shell. It reads the session to show who is signed in and to
 * redirect a signed-out visitor, but it is not the security boundary — every
 * page and action under it calls `requireStaff()` again for itself, because a
 * layout does not re-run on navigation and does not guard server actions.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const newEnquiries = await countNewEnquiries();

  return (
    <div className="min-h-svh md:grid md:grid-cols-[14rem_1fr]">
      <aside className="on-ink flex flex-col gap-6 px-4 py-5 md:sticky md:top-0 md:h-svh md:py-8">
        <Link href="/admin" className="flex items-center gap-3 px-3">
          <span className="bg-paper p-1">
            <Image src="/brand/logosa-mark.png" alt="" width={459} height={260} className="h-auto w-10" />
          </span>
          <span className="label text-paper">Booking desk</span>
        </Link>

        <AdminNav isOwner={me.role === "owner"} newEnquiries={newEnquiries} />

        <div className="mt-auto hidden border-t border-[var(--color-rule-invert)] px-3 pt-5 md:block">
          <p className="text-small text-paper">{me.name}</p>
          <p className="truncate text-micro text-[color-mix(in_srgb,var(--color-paper)_55%,transparent)]">{me.email}</p>
          <div className="mt-4 flex items-center gap-4">
            <form action={logout}>
              <button type="submit" className="link-rule">
                <span className="label-slim !text-paper">Sign out</span>
              </button>
            </form>
            <Link href="/" className="link-rule">
              <span className="label-slim !text-paper">Website</span>
            </Link>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
        {/* Sign-out on small screens, where the sidebar collapses to a tab row. */}
        <form action={logout} className="mx-auto mt-16 max-w-6xl border-t border-[var(--color-rule)] pt-5 md:hidden">
          <span className="text-small text-ink-soft">{me.name} · </span>
          <button type="submit" className="link-rule">
            <span className="label-slim">Sign out</span>
          </button>
        </form>
      </main>
    </div>
  );
}
