import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/common/PageHead";
import QuoteResponse from "@/components/booking/QuoteResponse";
import { bookingForTraveller } from "@/lib/bookings/service";
import { PAYMENT_METHOD_LABEL, STATUS_FOR_TRAVELLER } from "@/lib/bookings/status";
import { databaseConfigured } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { formatMoney } from "@/lib/money";
import { mailtoLink, whatsappLink } from "@/data/company";

/**
 * A traveller's booking, at a private link. The token in the URL is the only
 * credential — there are no traveller accounts — so this page shows the
 * booking's own details and nothing that belongs to anyone else, and the proxy
 * keeps it out of search results and out of Referer headers.
 */

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  });

export default async function BookingPage(props: PageProps<"/booking/[token]">) {
  if (!databaseConfigured()) notFound();
  const { token } = await props.params;
  const sp = await props.searchParams;
  const b = await bookingForTraveller(token);
  if (!b) notFound();

  const s = STATUS_FOR_TRAVELLER[b.status];
  const q = b.quote;
  const balance = q ? q.total - b.paid : null;
  const wa = whatsappLink(`Hello Logosa — about my booking ${b.reference}.`);
  const mail = mailtoLink(`Booking ${b.reference}`);

  return (
    <div className="bg-paper paper-grain">
      <PageHead
        kicker={`Booking ${b.reference}`}
        title={<>{s.title}.</>}
        standfirst={s.next}
        figures={[
          { label: "Journey", value: b.journeyName },
          { label: "Start", value: b.startDate ? `${day(b.startDate)}${b.flexibleDates ? " ±" : ""}` : "To be agreed" },
          { label: "Travellers", value: String(b.travellers) },
          { label: "Lead traveller", value: b.leadName },
        ]}
      />

      <div className="shell-narrow pb-chapter">
        {sp.new === "1" && (
          <div className="mb-12 border-l-2 border-[var(--color-gold)] pl-5">
            <p className="label text-gold-deep">Request sent</p>
            <p className="mt-2 max-w-2xl text-body leading-relaxed text-ink-soft">
              This page is your private link to the booking — bookmark it, and do not share it.
              {mailConfigured() && ` We have emailed it to ${b.email} as well.`} We will reply
              here and by email with your quote.
            </p>
          </div>
        )}

        {q && (
          <section aria-labelledby="quote" className="rule-t pt-8">
            <h2 id="quote" className="label-slim">
              Your quote
            </h2>
            <p className="mt-4 font-[family-name:var(--font-display)] text-display-m leading-none">
              {formatMoney(q.total, q.currency)}
            </p>
            <p className="mt-3 text-small text-ink-soft">
              For {b.travellers} {b.travellers === 1 ? "traveller" : "travellers"}
              {b.travellers > 1 && <> — about {formatMoney(Math.round(q.total / b.travellers), q.currency)} each</>}
              {q.deposit ? <>. Deposit to confirm: {formatMoney(q.deposit, q.currency)}</> : null}.
            </p>
            {q.validUntil && (
              <p className={`mt-2 text-small ${q.expired ? "text-terracotta" : "text-ink-faint"}`}>
                {q.expired ? `This quote expired on ${day(q.validUntil)}.` : `Valid until ${day(q.validUntil)}.`}
              </p>
            )}
            {q.notes && (
              <div className="mt-6 whitespace-pre-line border-l border-[var(--color-rule)] pl-5 text-body leading-relaxed text-ink">
                {q.notes}
              </div>
            )}
            {b.status === "quoted" && !q.expired && <QuoteResponse token={token} />}
          </section>
        )}

        {b.payments.length > 0 && q && (
          <section aria-labelledby="payments" className="mt-14 rule-t pt-8">
            <h2 id="payments" className="label-slim">
              Payments received
            </h2>
            <ul className="mt-4">
              {b.payments.map((p, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--color-rule)] py-3 text-small">
                  <span className="text-ink-soft">
                    {day(p.receivedOn)} · {PAYMENT_METHOD_LABEL[p.method]}
                  </span>
                  <span className="numeral text-ink">{formatMoney(p.amount, p.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-small">
              <dt className="text-ink-soft">Paid so far</dt>
              <dd className="numeral text-right text-ink">{formatMoney(b.paid, q.currency)}</dd>
              <dt className="text-ink-soft">Balance</dt>
              <dd className="numeral text-right text-ink">{formatMoney(Math.max(0, balance ?? 0), q.currency)}</dd>
            </dl>
          </section>
        )}

        {b.events.length > 0 && (
          <section aria-labelledby="history" className="mt-14 rule-t pt-8">
            <h2 id="history" className="label-slim">
              History
            </h2>
            <ol className="mt-4">
              {b.events.map((e, i) => (
                <li key={i} className="grid gap-x-6 border-b border-[var(--color-rule)] py-3 text-small md:grid-cols-[12rem_1fr]">
                  <span className="text-ink-faint">{when(e.at)}</span>
                  <span className="text-ink">{e.message}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-14 rule-t pt-8">
          <h2 className="label-slim">Questions</h2>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-ink-soft">
            Reply to any of our emails, or quote your reference{" "}
            <span className="ref text-ink">{b.reference}</span>
            {wa || mail ? " and contact us " : " when you contact us"}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="link-rule text-ink">
                on WhatsApp
              </a>
            )}
            {wa && mail && " or "}
            {mail && (
              <a href={mail} className="link-rule text-ink">
                by email
              </a>
            )}
            .
          </p>
          {b.journeySlug && (
            <p className="mt-4">
              <Link href={`/journeys/${b.journeySlug}`} className="link-rule">
                <span className="label">Read about {b.journeyName}</span>
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
