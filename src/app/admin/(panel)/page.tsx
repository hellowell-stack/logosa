import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Panel, PageTitle, Stat, StatusBadge, day, when } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/session";
import { dashboard } from "@/lib/bookings/service";
import { mailConfigured } from "@/lib/mail";

export const metadata: Metadata = { title: "Overview" };

export default async function Overview() {
  const me = await requireStaff();
  const d = await dashboard();
  const c = d.counts;

  return (
    <>
      <PageTitle kicker={`Namaste, ${me.name.split(" ")[0]}`} title="Overview">
        <Link href="/admin/bookings/new" className="btn">
          New booking
        </Link>
      </PageTitle>

      {!mailConfigured() && (
        <p className="mb-8 border-l-2 border-terracotta pl-4 text-small leading-relaxed text-ink">
          <strong className="font-semibold">Email is not set up.</strong> Requests and enquiries
          are still recorded here, but nobody is notified and travellers do not receive their quotes
          by email. Until RESEND_API_KEY is set, copy each traveller&apos;s link from their booking
          and send it yourself.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="New requests" value={c.requested ?? 0} href="/admin/bookings?status=requested" lit />
        <Stat label="Awaiting reply" value={c.quoted ?? 0} href="/admin/bookings?status=quoted" />
        <Stat label="Awaiting deposit" value={c.accepted ?? 0} href="/admin/bookings?status=accepted" lit />
        <Stat label="Confirmed" value={c.confirmed ?? 0} href="/admin/bookings?status=confirmed" />
        <Stat label="New enquiries" value={d.newEnquiries} href="/admin/enquiries" lit />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <Panel title="Departing in the next 60 days">
          {d.upcoming.length === 0 ? (
            <Empty>Nothing accepted or confirmed departs in the next two months.</Empty>
          ) : (
            <ul>
              {d.upcoming.map((b) => (
                <li key={b.id} className="border-b border-[var(--color-rule)] last:border-b-0">
                  <Link href={`/admin/bookings/${b.id}`} className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-3 py-3 hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]">
                    <span className="numeral text-small text-ink">{day(b.startDate)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-small text-ink">{b.journeyName}</span>
                      <span className="block truncate text-micro text-ink-faint">
                        {b.reference} · {b.leadName} · {b.travellers} pax
                      </span>
                    </span>
                    <StatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          {d.recent.length === 0 ? (
            <Empty>Nothing has happened yet. Booking requests from the website will appear here.</Empty>
          ) : (
            <ol>
              {d.recent.map(({ event, reference, staffName }) => (
                <li key={event.id} className="border-b border-[var(--color-rule)] py-3 last:border-b-0">
                  <Link href={`/admin/bookings/${event.bookingId}`} className="block hover:text-ink">
                    <span className="block text-small text-ink">
                      <span className="ref text-gold-deep">{reference}</span> {event.message}
                    </span>
                    <span className="block text-micro text-ink-faint">
                      {when(event.at)}
                      {staffName ? ` · ${staffName}` : event.actor === "traveller" ? " · traveller" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
