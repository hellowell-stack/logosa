import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { EnquiryBadge, PageTitle, Panel, when } from "@/components/admin/ui";
import Field from "@/components/forms/Field";
import { convertEnquiryAction, setEnquiryStatusAction } from "@/app/admin/_actions/enquiries";
import { destinationBySlug } from "@/data/destinations";
import { journeys } from "@/data/journeys";
import { requireStaff } from "@/lib/auth/session";
import { enquirySubject } from "@/lib/bookings/enquiry-subject";
import { enquiryDetail } from "@/lib/bookings/service";
import { isUuid } from "@/lib/form-result";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage(props: PageProps<"/admin/enquiries/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const e = await enquiryDetail(id);
  if (!e) notFound();

  const places = (e.destinationSlugs ?? []).map((s) => destinationBySlug(s)?.name).filter(Boolean);
  const reply = `mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry ${e.reference} — ${enquirySubject(e)}`)}`;
  const facts: [string, string | null | undefined][] = [
    ["Email", e.email],
    ["Phone", e.phone],
    ["Travellers", e.travellers?.toString()],
    ["Preferred start", e.preferredStart],
    ["Time available", e.duration],
    ["Journey", e.journeySlug ? enquirySubject({ journeySlug: e.journeySlug, destinationSlugs: null }) : null],
    ["Places", places.length ? places.join(", ") : null],
    ["Interests", e.experiences?.join(", ")],
  ];

  return (
    <>
      <PageTitle kicker={`Enquiry · ${when(e.createdAt)}`} title={e.name}>
        <EnquiryBadge status={e.status} />
      </PageTitle>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-8">
          <Panel title={`Enquiry ${e.reference}`}>
            <dl className="grid gap-x-6 gap-y-3 text-small sm:grid-cols-[9rem_1fr]">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-faint">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
            </dl>
            {e.message && (
              <p className="mt-6 whitespace-pre-line border-l border-[var(--color-rule)] pl-4 text-body leading-relaxed text-ink">
                {e.message}
              </p>
            )}
            {e.itinerary && (
              <>
                <p className="label-slim mt-6">From the trip planner</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap bg-paper-2 p-4 text-micro leading-relaxed text-ink">{e.itinerary}</pre>
              </>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-8">
          <Panel title="Reply">
            <a href={reply} className="btn">
              Reply by email
            </a>
            <p className="mt-3 text-micro leading-relaxed text-ink-faint">
              Opens your mail program with their address and the reference filled in. Mark it
              replied once you have sent it.
            </p>
            <ActionForm action={setEnquiryStatusAction} className="mt-5 flex flex-wrap gap-3">
              <input type="hidden" name="id" value={e.id} />
              {e.status !== "replied" && e.status !== "converted" && (
                <Submit ghost small name="status" value="replied">
                  Mark replied
                </Submit>
              )}
              {e.status !== "closed" && e.status !== "converted" && (
                <Submit ghost small name="status" value="closed">
                  Close
                </Submit>
              )}
              {(e.status === "closed" || e.status === "replied") && (
                <Submit ghost small name="status" value="new">
                  Reopen
                </Submit>
              )}
            </ActionForm>
            {e.handledByName && <p className="mt-4 text-micro text-ink-faint">Last handled by {e.handledByName}.</p>}
          </Panel>

          <Panel title="Booking">
            {e.bookingId ? (
              <Link href={`/admin/bookings/${e.bookingId}`} className="btn btn-ghost">
                Open the booking
              </Link>
            ) : (
              <ActionForm action={convertEnquiryAction}>
                <input type="hidden" name="id" value={e.id} />
                <p className="mb-4 text-small leading-relaxed text-ink-soft">
                  Ready to go ahead? Open a booking from this enquiry — their details and message
                  carry across, and you can quote from there.
                </p>
                <Field label="Journey">
                  <select name="journey" defaultValue={e.journeySlug ?? "custom"} className="field">
                    {journeys.map((j) => (
                      <option key={j.slug} value={j.slug}>
                        {j.name}
                      </option>
                    ))}
                    <option value="custom">Custom trip</option>
                  </select>
                </Field>
                <div className="mt-5">
                  <Submit busy="Opening…">Turn into a booking</Submit>
                </div>
              </ActionForm>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
