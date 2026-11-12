import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import BookingFields from "@/components/admin/BookingFields";
import CopyLink from "@/components/admin/CopyLink";
import { Empty, PageTitle, Panel, StatusBadge, day, when } from "@/components/admin/ui";
import Field from "@/components/forms/Field";
import {
  addNoteAction,
  deletePaymentAction,
  emailLinkAction,
  recordPaymentAction,
  regenerateLinkAction,
  sendQuoteAction,
  setStatusAction,
  updateDetailsAction,
} from "@/app/admin/_actions/bookings";
import { requireStaff } from "@/lib/auth/session";
import { bookingDetail, travellerLink } from "@/lib/bookings/service";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, can, quoteExpired } from "@/lib/bookings/status";
import type { Booking } from "@/lib/db/schema";
import { isUuid } from "@/lib/form-result";
import { mailConfigured } from "@/lib/mail";
import { CURRENCIES, formatMoney, fromMinor } from "@/lib/money";
import { todayInNepal } from "@/lib/validate";

export const metadata: Metadata = { title: "Booking" };

const SOURCE = { website: "Requested on the website", enquiry: "Opened from an enquiry", staff: "Opened by staff" } as const;

export default async function BookingDetailPage(props: PageProps<"/admin/bookings/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const detail = await bookingDetail(id);
  if (!detail) notFound();

  const { booking: b, payments, events, paid } = detail;
  const today = todayInNepal();
  const mail = mailConfigured();
  const currency = b.currency ?? "USD";
  const balance = b.quoteTotal !== null ? b.quoteTotal - paid : null;

  return (
    <>
      <PageTitle kicker={SOURCE[b.source]} title={<span className="ref">{b.reference}</span>}>
        <StatusBadge status={b.status} />
      </PageTitle>

      <p className="-mt-3 mb-8 text-body text-ink-soft">
        <span className="text-ink">{b.journeyName}</span> · {b.startDate ? day(b.startDate) : "date not set"}
        {b.flexibleDates && " (flexible)"} · {b.travellers} {b.travellers === 1 ? "traveller" : "travellers"} ·{" "}
        {b.leadName}
      </p>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        {/* ── Main column ── */}
        <div className="min-w-0 space-y-8">
          <NextStep b={b} mail={mail} />

          <Panel
            title="Quote"
            aside={b.quotedAt && <span className="text-micro text-ink-faint">Sent {when(b.quotedAt)}</span>}
          >
            {b.quoteTotal !== null && b.currency ? (
              <div className="mb-6">
                <p className="numeral font-[family-name:var(--font-display)] text-display-s leading-none">
                  {formatMoney(b.quoteTotal, b.currency)}
                </p>
                <p className="mt-2 text-small text-ink-soft">
                  {b.depositAmount ? `Deposit ${formatMoney(b.depositAmount, b.currency)}` : "No deposit set"}
                  {b.quoteValidUntil && (
                    <span className={quoteExpired(b.quoteValidUntil, today) ? " text-terracotta" : ""}>
                      {" "}
                      · {quoteExpired(b.quoteValidUntil, today) ? "expired" : "valid until"} {day(b.quoteValidUntil)}
                    </span>
                  )}
                </p>
                {b.quoteNotes && (
                  <p className="mt-4 whitespace-pre-line border-l border-[var(--color-rule)] pl-4 text-small leading-relaxed text-ink">
                    {b.quoteNotes}
                  </p>
                )}
              </div>
            ) : (
              <p className="mb-5 text-small text-ink-faint">No quote yet.</p>
            )}

            {can.quote(b.status) && (
              // The form wraps the <details>, not the reverse: sending a quote
              // collapses it, and the confirmation must still be visible.
              <ActionForm action={sendQuoteAction}>
                <input type="hidden" name="id" value={b.id} />
                <details open={b.quoteTotal === null}>
                  <summary className="cursor-pointer list-none">
                    <span className="label link-rule">{b.quoteTotal === null ? "Write the quote" : "Revise the quote"}</span>
                  </summary>
                  <div className="mt-5">
                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
                    <Field label="Currency">
                      <select name="currency" defaultValue={currency} className="field">
                        {CURRENCIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Total" hint={`For ${b.travellers}`}>
                      <input name="total" inputMode="decimal" defaultValue={b.quoteTotal !== null ? fromMinor(b.quoteTotal) : ""} required className="field" />
                    </Field>
                    <Field label="Deposit" hint="Optional">
                      <input name="deposit" inputMode="decimal" defaultValue={b.depositAmount !== null ? fromMinor(b.depositAmount) : ""} className="field" />
                    </Field>
                    <Field label="Valid until" hint="Optional" className="sm:col-span-3">
                      <input name="validUntil" type="date" min={today} defaultValue={b.quoteValidUntil ?? ""} className="field max-w-xs" />
                    </Field>
                    <Field label="What the price covers — shown to the traveller" className="sm:col-span-3">
                      <textarea
                        name="notes"
                        rows={6}
                        defaultValue={b.quoteNotes ?? ""}
                        placeholder={"Included: …\nNot included: …\nCancellation terms: …"}
                        className="field resize-y"
                      />
                    </Field>
                  </div>
                  <label className="mt-5 flex items-center gap-3">
                    <input name="notify" type="checkbox" defaultChecked={mail} disabled={!mail} className="h-4 w-4 accent-[var(--color-ink)]" />
                    <span className="text-small text-ink-soft">
                      {mail ? "Email the quote to the traveller" : "Email is not set up — send the traveller their link yourself"}
                    </span>
                  </label>
                  <div className="mt-5">
                    <Submit busy="Sending…">{b.quoteTotal === null ? "Send quote" : "Send revised quote"}</Submit>
                  </div>
                  </div>
                </details>
              </ActionForm>
            )}
          </Panel>

          <Panel
            title="Payments"
            aside={
              balance !== null && (
                <span className="numeral text-small">
                  {formatMoney(paid, currency)} paid · <span className={balance > 0 ? "text-ink" : "text-pine"}>{formatMoney(Math.max(0, balance), currency)} due</span>
                </span>
              )
            }
          >
            {payments.length === 0 ? (
              <Empty>No payments recorded.</Empty>
            ) : (
              <ul className="mb-6">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-rule)] py-3">
                    <div className="min-w-0">
                      <p className="text-small text-ink">
                        <span className="numeral">{formatMoney(p.amount, p.currency)}</span> · {PAYMENT_METHOD_LABEL[p.method]} ·{" "}
                        {day(p.receivedOn)}
                      </p>
                      <p className="text-micro text-ink-faint">
                        {[p.reference && `Ref ${p.reference}`, p.note, p.recordedByName && `recorded by ${p.recordedByName}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ActionForm action={deletePaymentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <Submit ghost small busy="Removing…">
                        Remove
                      </Submit>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}

            {can.pay(b.status) && (
              <ActionForm action={recordPaymentAction} resetOnSuccess>
                <input type="hidden" name="id" value={b.id} />
                <details open={payments.length === 0 && (b.status === "accepted" || b.status === "confirmed")}>
                  <summary className="cursor-pointer list-none">
                    <span className="label link-rule">Record a payment</span>
                  </summary>
                  <div className="mt-5">
                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
                    <Field label="Amount">
                      <input name="amount" inputMode="decimal" required className="field" />
                    </Field>
                    <Field label="Currency">
                      <select name="currency" defaultValue={currency} className="field">
                        {CURRENCIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Method">
                      <select name="method" defaultValue="bank-transfer" className="field">
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABEL[m]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Received on">
                      <input name="receivedOn" type="date" max={today} defaultValue={today} required className="field" />
                    </Field>
                    <Field label="Reference" hint="Optional">
                      <input name="reference" className="field" />
                    </Field>
                    <Field label="Note" hint="Optional">
                      <input name="note" className="field" />
                    </Field>
                  </div>
                  <p className="mt-4 text-micro text-ink-faint">
                    The traveller sees the amount, date and method on their booking page — not the reference or note.
                  </p>
                  <div className="mt-5">
                    <Submit busy="Recording…">Record payment</Submit>
                  </div>
                  </div>
                </details>
              </ActionForm>
            )}
          </Panel>

          <Panel title="History">
            <ActionForm action={addNoteAction} resetOnSuccess className="mb-6">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Add an internal note" hint="Staff only">
                <textarea name="note" rows={2} className="field resize-y" />
              </Field>
              <div className="mt-3">
                <Submit ghost small busy="Adding…">
                  Add note
                </Submit>
              </div>
            </ActionForm>
            <ol>
              {events.map((e) => (
                <li key={e.id} className="border-b border-[var(--color-rule)] py-3 last:border-b-0">
                  <p className={`whitespace-pre-line text-small ${e.kind === "note" ? "text-ink" : "text-ink-soft"}`}>{e.message}</p>
                  <p className="mt-0.5 text-micro text-ink-faint">
                    {when(e.at)}
                    {e.staffName ? ` · ${e.staffName}` : e.actor === "traveller" ? " · traveller" : ""}
                    {e.public && " · visible to traveller"}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {/* ── Side column ── */}
        <div className="min-w-0 space-y-8">
          <Panel title="Traveller's link">
            <CopyLink url={travellerLink(b.accessToken)} />
            <p className="mt-3 text-micro leading-relaxed text-ink-faint">
              Private to this traveller: it shows the quote and lets them accept it. Anyone with the
              link can see the booking, so send it only to them.
            </p>
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <ActionForm action={emailLinkAction}>
                <input type="hidden" name="id" value={b.id} />
                <Submit ghost small busy="Sending…">
                  Email it to them
                </Submit>
              </ActionForm>
              <a href={`/booking/${b.accessToken}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !px-4 !py-2.5">
                View as traveller
              </a>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer list-none text-micro text-ink-faint">
                <span className="link-rule">Link sent to the wrong person?</span>
              </summary>
              <ActionForm action={regenerateLinkAction} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <p className="mb-3 text-micro leading-relaxed text-ink-soft">
                  Issue a new link. The current one stops working at once, and you will need to send
                  the new one to the traveller.
                </p>
                <Submit ghost small busy="Replacing…">
                  Replace the link
                </Submit>
              </ActionForm>
            </details>
          </Panel>

          {b.travellerNotes && (
            <Panel title="From the traveller">
              <p className="whitespace-pre-line text-small leading-relaxed text-ink">{b.travellerNotes}</p>
              {b.enquiryId && (
                <Link href={`/admin/enquiries/${b.enquiryId}`} className="link-rule mt-4 inline-block">
                  <span className="label-slim">Original enquiry</span>
                </Link>
              )}
            </Panel>
          )}

          <Panel title="Details">
            <ActionForm action={updateDetailsAction}>
              <input type="hidden" name="id" value={b.id} />
              <BookingFields v={b} />
              <div className="mt-6">
                <Submit ghost>Save details</Submit>
              </div>
            </ActionForm>
          </Panel>

          {can.cancel(b.status) && (
            <details className="border border-[var(--color-rule)] p-5">
              <summary className="cursor-pointer list-none">
                <span className="label text-terracotta">Cancel this booking</span>
              </summary>
              <ActionForm action={setStatusAction} className="mt-4">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="to" value="cancelled" />
                <Field label="Reason" hint="Recorded, and emailed if you choose">
                  <input name="reason" required className="field" />
                </Field>
                <label className="mt-4 flex items-center gap-3">
                  <input name="notify" type="checkbox" defaultChecked={mail} disabled={!mail} className="h-4 w-4 accent-[var(--color-ink)]" />
                  <span className="text-small text-ink-soft">Email the traveller</span>
                </label>
                {paid > 0 && (
                  <p className="mt-4 text-micro leading-relaxed text-terracotta">
                    {formatMoney(paid, currency)} has been paid on this booking. Cancelling does not refund it —
                    arrange any refund separately.
                  </p>
                )}
                <div className="mt-5">
                  <Submit danger busy="Cancelling…">
                    Cancel booking
                  </Submit>
                </div>
              </ActionForm>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

/** What this booking needs from staff right now, with the button that does it. */
function NextStep({ b, mail }: { b: Booking; mail: boolean }) {
  const text: Record<Booking["status"], string> = {
    requested: "Price the trip and send the quote below. The traveller can accept it from their link.",
    quoted: `Waiting for ${b.leadName} to accept or decline. You can revise the quote meanwhile — or, if they accepted by email or phone, confirm the booking yourself.`,
    accepted: `${b.leadName} accepted the quote. Send deposit instructions, record the deposit under Payments when it arrives, then confirm.`,
    confirmed: "Confirmed. Mark it completed once the trip is over.",
    completed: "This trip is complete. Nothing more to do.",
    declined: `${b.leadName} declined the quote. You can send a revised one, which reopens it.`,
    cancelled: `Cancelled${b.cancelReason ? ` — ${b.cancelReason}` : ""}.`,
  };

  return (
    <section className="border-l-2 border-gold pl-5">
      <p className="label-slim">Next step</p>
      <p className="mt-2 text-body leading-relaxed text-ink">{text[b.status]}</p>

      {(can.confirm(b.status) || can.complete(b.status)) && (
        <ActionForm action={setStatusAction} className="mt-4">
          <input type="hidden" name="id" value={b.id} />
          {can.confirm(b.status) ? (
            <>
              <input type="hidden" name="to" value="confirmed" />
              <label className="mb-4 flex items-center gap-3">
                <input name="notify" type="checkbox" defaultChecked={mail} disabled={!mail} className="h-4 w-4 accent-[var(--color-ink)]" />
                <span className="text-small text-ink-soft">Email the traveller their confirmation</span>
              </label>
              <Submit busy="Confirming…">Confirm booking</Submit>
            </>
          ) : (
            <>
              <input type="hidden" name="to" value="completed" />
              <Submit ghost busy="Saving…">
                Mark completed
              </Submit>
            </>
          )}
        </ActionForm>
      )}
    </section>
  );
}
