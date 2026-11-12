import type { Metadata } from "next";
import Link from "next/link";
import { publishedJourneys } from "@/data/journeys";
import PageHead from "@/components/common/PageHead";
import BookingForm from "@/components/booking/BookingForm";
import { databaseConfigured } from "@/lib/db";
import { todayInNepal } from "@/lib/validate";

export const metadata: Metadata = {
  title: "Request a booking",
  description:
    "Choose a journey and a start date and Logosa will reply with a quote for your group. Nothing is charged until you accept it.",
  alternates: { canonical: "/book" },
};

const STEPS = [
  ["Request", "Choose a journey, a start date and your group size. This page sends the request."],
  ["Quote", "A person at Logosa prices your trip for your group and sends a written quote."],
  ["Accept", "Read it on your private booking page and accept it — or ask us to change it."],
  ["Confirm", "Pay the deposit by the method we agree with you. The booking is confirmed once it arrives."],
] as const;

export default async function BookPage(props: PageProps<"/book">) {
  const sp = await props.searchParams;
  const wanted = Array.isArray(sp.journey) ? sp.journey[0] : sp.journey;
  const journeys = publishedJourneys.map((j) => ({ slug: j.slug, name: j.name, days: j.days }));
  const initial = journeys.some((j) => j.slug === wanted) ? wanted : undefined;
  const tomorrow = new Date(Date.parse(`${todayInNepal()}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="bg-paper paper-grain">
      <PageHead
        kicker="Book"
        deva="आरक्षण"
        title={<>Request a booking.</>}
        standfirst="Journeys in Nepal are priced per group, so a booking starts as a request. We reply with a quote; nothing is charged until you have accepted it."
        breadcrumb={[{ href: "/", label: "Logosa" }, { href: "/journeys", label: "Journeys" }]}
      />

      <div className="shell pb-chapter">
        <div className="grid-editorial gap-y-14">
          <div className="col-span-12 lg:col-span-7">
            {databaseConfigured() ? (
              <BookingForm journeys={journeys} initialJourney={initial} minDate={tomorrow} />
            ) : (
              <div className="border border-ink p-8">
                <p className="label text-gold-deep">Not available yet</p>
                <p className="mt-4 max-w-lg text-body leading-relaxed text-ink-soft">
                  Online booking requests are not switched on yet. Send us an enquiry instead — it
                  reaches the same people, and we will reply with a quote.
                </p>
                <Link href={initial ? `/contact?journey=${initial}` : "/contact"} className="btn mt-6">
                  Send an enquiry
                </Link>
              </div>
            )}
          </div>

          <aside className="col-span-12 lg:col-span-4 lg:col-start-9">
            <p className="label-slim">How booking works</p>
            <ol className="mt-5 rule-t">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-b border-[var(--color-rule)] py-5">
                  <span className="numeral text-title text-gold-deep">{i + 1}</span>
                  <span>
                    <span className="label text-ink">{title}</span>
                    <span className="mt-2 block text-small leading-relaxed text-ink-soft">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-small leading-relaxed text-ink-soft">
              Not ready to pick a date?{" "}
              <Link href="/contact" className="link-rule text-ink">
                Send an enquiry
              </Link>{" "}
              instead.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
