"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The admin's sections. The active one follows the URL. */
export default function AdminNav({ isOwner, newEnquiries }: { isOwner: boolean; newEnquiries: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/enquiries", label: "Enquiries", count: newEnquiries },
    { href: "/admin/customers", label: "Customers" },
    ...(isOwner ? [{ href: "/admin/staff", label: "Staff" }] : []),
    { href: "/admin/account", label: "Account" },
  ];

  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-3 whitespace-nowrap px-3 py-2 text-small transition-colors ${
              active ? "bg-paper text-ink" : "text-[color-mix(in_srgb,var(--color-paper)_72%,transparent)] hover:text-paper"
            }`}
          >
            {it.label}
            {"count" in it && it.count ? (
              <span className="numeral bg-gold px-1.5 text-micro leading-5 text-ink">{it.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
