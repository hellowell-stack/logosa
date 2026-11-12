import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle, StatusBadge, Table, Tabs, day, td, th, when } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/session";
import { listBookings, type BookingFilter } from "@/lib/bookings/service";
import { STATUS_LABEL, isBookingStatus } from "@/lib/bookings/status";
import { formatMoney } from "@/lib/money";
import { clean } from "@/lib/validate";

export const metadata: Metadata = { title: "Bookings" };

const TABS: { key: BookingFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "requested", label: STATUS_LABEL.requested },
  { key: "quoted", label: STATUS_LABEL.quoted },
  { key: "accepted", label: "Accepted" },
  { key: "confirmed", label: STATUS_LABEL.confirmed },
  { key: "completed", label: STATUS_LABEL.completed },
  { key: "declined", label: STATUS_LABEL.declined },
  { key: "cancelled", label: STATUS_LABEL.cancelled },
  { key: "all", label: "All" },
];

export default async function BookingsPage(props: PageProps<"/admin/bookings">) {
  await requireStaff();
  const sp = await props.searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "open";
  const status: BookingFilter = raw === "all" || raw === "open" || isBookingStatus(raw) ? raw : "open";
  const q = clean(sp.q, 100);
  const rows = await listBookings({ status, q: q || undefined });
  const href = (s: string) => `/admin/bookings?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageTitle title="Bookings">
        <form className="flex items-center gap-2" role="search">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Reference, name, email, journey"
            aria-label="Search bookings"
            className="field w-64 !py-2"
          />
          <button type="submit" className="btn btn-ghost !px-4 !py-2.5">
            Search
          </button>
        </form>
        <Link href="/admin/bookings/new" className="btn !px-4 !py-2.5">
          New booking
        </Link>
      </PageTitle>

      <Tabs current={status} items={TABS.map((t) => ({ ...t, href: href(t.key) }))} />

      {q && (
        <p className="mb-4 text-small text-ink-soft">
          {rows.length} {rows.length === 1 ? "result" : "results"} for “{q}”.{" "}
          <Link href={`/admin/bookings?status=${status}`} className="link-rule">
            Clear search
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <Empty>{q ? "No bookings match that search." : "No bookings in this list."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Reference</th>
              <th className={th}>Lead traveller</th>
              <th className={th}>Journey</th>
              <th className={th}>Start</th>
              <th className={`${th} text-right`}>Pax</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Quote · paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]">
                <td className={td}>
                  <Link href={`/admin/bookings/${b.id}`} className="ref link-rule text-ink">
                    {b.reference}
                  </Link>
                  <span className="mt-1 block text-micro text-ink-faint">{when(b.createdAt)}</span>
                </td>
                <td className={td}>
                  <span className="block text-ink">{b.leadName}</span>
                  <span className="block text-micro text-ink-faint">{b.email}</span>
                </td>
                <td className={td}>{b.journeyName}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {day(b.startDate)}
                  {b.flexibleDates && <span className="text-ink-faint"> ±</span>}
                </td>
                <td className={`${td} tabular-nums text-right`}>{b.travellers}</td>
                <td className={td}>
                  <StatusBadge status={b.status} />
                </td>
                <td className={`${td} tabular-nums whitespace-nowrap text-right`}>
                  {b.quoteTotal !== null && b.currency ? (
                    <>
                      <span className="block text-ink">{formatMoney(b.quoteTotal, b.currency)}</span>
                      <span className="block text-micro text-ink-faint">{formatMoney(b.paid, b.currency)} paid</span>
                    </>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
