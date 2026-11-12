import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter, UpdateFilter } from "mongodb";
import { getDb, isDuplicateKey } from "@/lib/db";
import type {
  Booking,
  BookingDoc,
  BookingEvent,
  BookingSource,
  BookingStatus,
  Enquiry,
  EnquiryDoc,
  EnquiryStatus,
  EventActor,
  Payment,
  PaymentMethod,
} from "@/lib/db/schema";
import { reference, token } from "@/lib/ids";
import { formatMoney, type Currency } from "@/lib/money";
import { section, sendMail, staffInbox } from "@/lib/mail";
import { todayInNepal } from "@/lib/validate";
import { SITE_URL, company } from "@/data/company";
import { OPEN_STATUSES, PAYMENT_METHOD_LABEL, STATUS_FOR_TRAVELLER, quoteExpired } from "./status";

/**
 * THE BOOKING SERVICE — every read and write the booking desk makes.
 *
 * Pages and server actions never touch the collections directly. They call
 * these functions, which is where the lifecycle rules are enforced and where
 * every change is written to the booking's history.
 *
 * Status changes are compare-and-set: `findOneAndUpdate({ _id, status: { $in:
 * allowed } }, …)`. If two staff members act at once, or a traveller
 * double-clicks accept, exactly one write lands and the other is told the
 * booking moved on. The history entry is pushed in the same update, on the
 * same document, so the two can never disagree.
 */

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });
const MOVED_ON = "This booking changed while you were looking at it. Reload the page and try again.";

export const travellerLink = (accessToken: string) => `${SITE_URL}/booking/${accessToken}`;
const adminLink = (id: string) => `${SITE_URL}/admin/bookings/${id}`;

// ── Internals ─────────────────────────────────────────────────────────────

interface Actor {
  staffId: string;
  staffName: string;
}

/** A booking without its embedded arrays, and with `id` rather than `_id`. */
function toBooking(doc: BookingDoc): Booking {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, payments, events, ...rest } = doc;
  return { id: _id, ...rest };
}

const toEnquiry = ({ _id, ...rest }: EnquiryDoc): Enquiry => ({ id: _id, ...rest });

/** Leave the embedded arrays behind when reading lists. */
const WITHOUT_ARRAYS = { projection: { payments: 0, events: 0 } } as const;

/**
 * The history entry for a change, and the `updatedAt` that goes with it —
 * always the same instant. The dashboard's recent-activity query depends on
 * that: it only unwinds the most recently updated bookings, which is correct
 * only because every bump of `updatedAt` pushes an event stamped the same.
 */
function change(
  e: { actor: EventActor; kind: string; message: string; public?: boolean; by?: Actor },
  extra: { $set?: Partial<BookingDoc>; $push?: Partial<Record<"payments", Payment>> } = {},
): UpdateFilter<BookingDoc> {
  const at = new Date();
  const event: BookingEvent = {
    id: randomUUID(),
    at,
    actor: e.actor,
    staffId: e.by?.staffId ?? null,
    staffName: e.by?.staffName ?? null,
    kind: e.kind,
    message: e.message,
    public: e.public ?? false,
  };
  return {
    $set: { ...extra.$set, updatedAt: at },
    $push: { ...extra.$push, events: event },
  } as UpdateFilter<BookingDoc>;
}

/** Insert with a fresh human reference, retrying on the (very rare) collision. */
async function withReference<T>(prefix: "LG" | "EN", insert: (ref: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await insert(reference(prefix));
    } catch (err) {
      if (attempt < 4 && isDuplicateKey(err)) continue;
      throw err;
    }
  }
}

/** Text search input, made safe to put inside a regular expression. */
const literal = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

const sumIn = (rows: { amount: number; currency: string }[], currency: string | null) =>
  currency ? rows.filter((r) => r.currency === currency).reduce((s, r) => s + r.amount, 0) : 0;

// ── Creating ──────────────────────────────────────────────────────────────

export interface NewBooking {
  journeySlug: string | null;
  journeyName: string;
  startDate: string | null;
  flexibleDates: boolean;
  travellers: number;
  leadName: string;
  email: string;
  phone: string | null;
  country: string | null;
  travellerNotes: string | null;
  source: BookingSource;
  enquiryId?: string | null;
}

export async function createBooking(input: NewBooking, by?: Actor): Promise<Booking> {
  const d = await getDb();

  const doc = await withReference("LG", async (ref) => {
    const now = new Date();
    const doc: BookingDoc = {
      _id: randomUUID(),
      reference: ref,
      accessToken: token(),
      status: "requested",
      ...input,
      email: input.email.toLowerCase(),
      enquiryId: input.enquiryId ?? null,
      currency: null,
      quoteTotal: null,
      depositAmount: null,
      quoteNotes: null,
      quoteValidUntil: null,
      quotedAt: null,
      acceptedAt: null,
      declinedAt: null,
      confirmedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
      payments: [],
      events: [
        {
          id: randomUUID(),
          at: now,
          actor: by ? "staff" : "traveller",
          staffId: by?.staffId ?? null,
          staffName: by?.staffName ?? null,
          kind: "created",
          message: by
            ? `Booking opened by ${by.staffName}${input.source === "enquiry" ? " from an enquiry" : ""}.`
            : "Booking request received through the website.",
          public: true,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await d.bookings.insertOne(doc);
    return doc;
  });

  const booking = toBooking(doc);
  if (!by) await notifyRequested(booking);
  return booking;
}

async function notifyRequested(b: Booking) {
  const trip = tripLines(b);
  await Promise.all([
    sendMail({
      to: b.email,
      subject: `Your booking request ${b.reference} — ${company.shortName}`,
      text: [
        `Dear ${b.leadName},`,
        "",
        `Thank you — we have your request for ${b.journeyName}. A person at ${company.shortName} will read it and reply with a quote for your group. Nothing is charged until you have accepted a quote.`,
        "",
        section("Your request", trip),
        "",
        "You can follow your booking, and accept the quote when it arrives, here:",
        travellerLink(b.accessToken),
        "",
        "Keep this email: that link is private to you.",
        "",
        `— ${company.legalName}`,
      ].join("\n"),
    }),
    notifyStaff(
      `Booking request ${b.reference}: ${b.journeyName} — ${b.leadName}`,
      [
        section("New booking request", [
          ...trip,
          `Lead:        ${b.leadName} <${b.email}>`,
          b.phone && `Phone:       ${b.phone}`,
          b.country && `Country:     ${b.country}`,
        ]),
        b.travellerNotes ? `\n${section("Their note", [b.travellerNotes])}` : "",
        "",
        `Open in the admin: ${adminLink(b.id)}`,
      ].join("\n"),
      b.email,
    ),
  ]);
}

async function notifyStaff(subject: string, text: string, replyTo?: string) {
  const to = staffInbox();
  if (to) await sendMail({ to, subject, text, replyTo });
}

function tripLines(b: Booking): string[] {
  return [
    `Reference:   ${b.reference}`,
    `Journey:     ${b.journeyName}`,
    `Start:       ${b.startDate ?? "Not set"}${b.flexibleDates ? " (flexible)" : ""}`,
    `Travellers:  ${b.travellers}`,
  ];
}

// ── Reading ───────────────────────────────────────────────────────────────

export type BookingFilter = BookingStatus | "open" | "all";

export async function listBookings(filter: { status?: BookingFilter; q?: string } = {}) {
  const d = await getDb();
  const where: Filter<BookingDoc> = {};
  if (filter.status === "open" || !filter.status) where.status = { $in: [...OPEN_STATUSES] };
  else if (filter.status !== "all") where.status = filter.status;
  if (filter.q) {
    const re = literal(filter.q);
    where.$or = [{ reference: re }, { leadName: re }, { email: re }, { journeyName: re }];
  }

  // Payments are small and needed for the "paid" column; the history is not.
  const rows = await d.bookings
    .find(where, { projection: { events: 0 } })
    .sort({ createdAt: -1 })
    .limit(300)
    .toArray();
  return rows.map((r) => ({ ...toBooking(r), paid: sumIn(r.payments ?? [], r.currency) }));
}

export async function bookingDetail(id: string) {
  const d = await getDb();
  const doc = await d.bookings.findOne({ _id: id });
  if (!doc) return null;

  return {
    booking: toBooking(doc),
    payments: [...doc.payments].sort(
      (a, b) => b.receivedOn.localeCompare(a.receivedOn) || +b.createdAt - +a.createdAt,
    ),
    events: [...doc.events].sort((a, b) => +b.at - +a.at),
    paid: sumIn(doc.payments, doc.currency),
  };
}

/**
 * What a traveller may see of their own booking — and nothing else. Internal
 * notes, staff names, payment references, the cancellation reason and the
 * enquiry link stay out.
 */
export async function bookingForTraveller(accessToken: string) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(accessToken)) return null;
  const d = await getDb();
  const b = await d.bookings.findOne({ accessToken });
  if (!b) return null;

  return {
    reference: b.reference,
    status: b.status,
    journeyName: b.journeyName,
    journeySlug: b.journeySlug,
    startDate: b.startDate,
    flexibleDates: b.flexibleDates,
    travellers: b.travellers,
    leadName: b.leadName,
    email: b.email,
    quote:
      b.quoteTotal !== null && b.currency && b.status !== "requested"
        ? {
            currency: b.currency,
            total: b.quoteTotal,
            deposit: b.depositAmount,
            notes: b.quoteNotes,
            validUntil: b.quoteValidUntil,
            expired: quoteExpired(b.quoteValidUntil, todayInNepal()),
          }
        : null,
    payments: [...b.payments]
      .sort((x, y) => y.receivedOn.localeCompare(x.receivedOn))
      .map(({ amount, currency, receivedOn, method }) => ({ amount, currency, receivedOn, method })),
    paid: sumIn(b.payments, b.currency),
    events: b.events
      .filter((e) => e.public)
      .sort((x, y) => +y.at - +x.at)
      .map(({ at, message }) => ({ at, message })),
  };
}

// ── The traveller's side ──────────────────────────────────────────────────

export async function respondToQuote(accessToken: string, answer: "accept" | "decline"): Promise<Result> {
  const d = await getDb();
  const current = await d.bookings.findOne({ accessToken }, WITHOUT_ARRAYS);
  if (!current) return fail("We could not find that booking.");
  if (current.status !== "quoted") return fail("This quote is no longer waiting for an answer.");
  if (answer === "accept" && quoteExpired(current.quoteValidUntil, todayInNepal())) {
    return fail("This quote has expired. Reply to our email and we will send you an up-to-date one.");
  }

  const accepted = answer === "accept";
  const updated = await d.bookings.findOneAndUpdate(
    { _id: current._id, status: "quoted" },
    change(
      {
        actor: "traveller",
        kind: accepted ? "accepted" : "declined",
        message: accepted ? "Quote accepted by the traveller." : "Quote declined by the traveller.",
        public: true,
      },
      { $set: accepted ? { status: "accepted", acceptedAt: new Date() } : { status: "declined", declinedAt: new Date() } },
    ),
    { returnDocument: "after", ...WITHOUT_ARRAYS },
  );
  if (!updated) return fail("This quote is no longer waiting for an answer.");

  await notifyStaff(
    `${updated.reference} ${accepted ? "ACCEPTED" : "declined"}: ${updated.journeyName} — ${updated.leadName}`,
    [
      `${updated.leadName} ${accepted ? "accepted" : "declined"} the quote of ${formatMoney(updated.quoteTotal ?? 0, updated.currency ?? "USD")}.`,
      accepted ? "Send deposit instructions, then record the payment and confirm the booking." : "",
      "",
      `Open in the admin: ${adminLink(updated._id)}`,
    ].join("\n"),
    updated.email,
  );
  return ok(undefined);
}

// ── The staff side ────────────────────────────────────────────────────────

export interface QuoteInput {
  currency: Currency;
  total: number;
  deposit: number | null;
  notes: string | null;
  validUntil: string | null;
  notify: boolean;
}

export async function sendQuote(id: string, q: QuoteInput, by: Actor): Promise<Result> {
  const d = await getDb();
  const updated = await d.bookings.findOneAndUpdate(
    { _id: id, status: { $in: ["requested", "quoted", "declined"] } },
    change(
      {
        actor: "staff",
        by,
        kind: "quoted",
        message: `Quote of ${formatMoney(q.total, q.currency)} sent${q.deposit ? `, deposit ${formatMoney(q.deposit, q.currency)}` : ""}.`,
        public: true,
      },
      {
        $set: {
          status: "quoted",
          currency: q.currency,
          quoteTotal: q.total,
          depositAmount: q.deposit,
          quoteNotes: q.notes,
          quoteValidUntil: q.validUntil,
          quotedAt: new Date(),
          // A revised quote reopens the question, so earlier answers are cleared.
          acceptedAt: null,
          declinedAt: null,
        },
      },
    ),
    { returnDocument: "after", ...WITHOUT_ARRAYS },
  );
  if (!updated) return fail(MOVED_ON);

  if (q.notify) {
    await sendMail({
      to: updated.email,
      replyTo: staffInbox() ?? undefined,
      subject: `Your quote for ${updated.journeyName} — ${updated.reference}`,
      text: [
        `Dear ${updated.leadName},`,
        "",
        `Your quote for ${updated.journeyName} is ready.`,
        "",
        section("Quote", [
          `Total:       ${formatMoney(q.total, q.currency)} for ${updated.travellers} ${updated.travellers === 1 ? "traveller" : "travellers"}`,
          q.deposit ? `Deposit:     ${formatMoney(q.deposit, q.currency)}` : null,
          q.validUntil && `Valid until: ${q.validUntil}`,
        ]),
        q.notes ? `\n${section("What this covers", [q.notes])}` : "",
        "",
        "Read it in full, and accept or decline it, here:",
        travellerLink(updated.accessToken),
        "",
        "Or simply reply to this email with any questions.",
        "",
        `— ${company.legalName}`,
      ].join("\n"),
    });
  }
  return ok(undefined);
}

export async function setStatus(
  id: string,
  to: "confirmed" | "completed" | "cancelled",
  by: Actor,
  opts: { reason?: string | null; notify?: boolean } = {},
): Promise<Result> {
  const from: Record<typeof to, BookingStatus[]> = {
    confirmed: ["quoted", "accepted"],
    completed: ["confirmed"],
    cancelled: [...OPEN_STATUSES],
  };
  const stamp: Partial<BookingDoc> =
    to === "confirmed"
      ? { confirmedAt: new Date() }
      : to === "completed"
        ? { completedAt: new Date() }
        : { cancelledAt: new Date(), cancelReason: opts.reason ?? null };

  const d = await getDb();
  const updated = await d.bookings.findOneAndUpdate(
    { _id: id, status: { $in: from[to] } },
    change(
      {
        actor: "staff",
        by,
        kind: to,
        message:
          to === "cancelled"
            ? `Booking cancelled${opts.reason ? ` — ${opts.reason}` : ""}.`
            : to === "confirmed"
              ? "Booking confirmed."
              : "Trip completed.",
        public: true,
      },
      { $set: { status: to, ...stamp } },
    ),
    { returnDocument: "after", ...WITHOUT_ARRAYS },
  );
  if (!updated) return fail(MOVED_ON);

  if (opts.notify && to !== "completed") {
    const s = STATUS_FOR_TRAVELLER[to];
    const b = toBooking({ ...updated, payments: [], events: [] });
    await sendMail({
      to: b.email,
      replyTo: staffInbox() ?? undefined,
      subject: `${s.title}: ${b.journeyName} — ${b.reference}`,
      text: [
        `Dear ${b.leadName},`,
        "",
        s.next,
        to === "cancelled" && opts.reason ? `\nReason: ${opts.reason}` : "",
        "",
        section("Your booking", tripLines(b)),
        "",
        travellerLink(b.accessToken),
        "",
        `— ${company.legalName}`,
      ].join("\n"),
    });
  }
  return ok(undefined);
}

export async function updateDetails(
  id: string,
  fields: Pick<
    NewBooking,
    "journeySlug" | "journeyName" | "startDate" | "flexibleDates" | "travellers" | "leadName" | "email" | "phone" | "country"
  >,
  by: Actor,
): Promise<Result> {
  const d = await getDb();
  const res = await d.bookings.updateOne(
    { _id: id },
    change(
      { actor: "staff", by, kind: "edited", message: "Trip or traveller details edited." },
      { $set: { ...fields, email: fields.email.toLowerCase() } },
    ),
  );
  return res.matchedCount ? ok(undefined) : fail("That booking no longer exists.");
}

export interface PaymentInput {
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  receivedOn: string;
  reference: string | null;
  note: string | null;
}

export async function recordPayment(bookingId: string, p: PaymentInput, by: Actor): Promise<Result> {
  const d = await getDb();
  const payment: Payment = {
    id: randomUUID(),
    ...p,
    recordedBy: by.staffId,
    recordedByName: by.staffName,
    createdAt: new Date(),
  };
  const res = await d.bookings.updateOne(
    { _id: bookingId, status: { $nin: ["cancelled", "declined"] } },
    change(
      {
        actor: "staff",
        by,
        kind: "payment",
        message: `Payment of ${formatMoney(p.amount, p.currency)} received (${PAYMENT_METHOD_LABEL[p.method].toLowerCase()}).`,
        public: true,
      },
      { $push: { payments: payment } },
    ),
  );
  if (res.matchedCount) return ok(undefined);

  const exists = await d.bookings.countDocuments({ _id: bookingId });
  return fail(
    exists
      ? "Payments cannot be recorded against a cancelled or declined booking."
      : "That booking no longer exists.",
  );
}

export async function deletePayment(paymentId: string, by: Actor): Promise<Result<string>> {
  const d = await getDb();
  const owner = await d.bookings.findOne({ "payments.id": paymentId }, { projection: { payments: 1 } });
  const p = owner?.payments.find((x) => x.id === paymentId);
  if (!owner || !p) return fail("That payment was already removed.");

  const res = await d.bookings.updateOne(
    // Matching on the payment too means a concurrent removal is a no-op, not a double event.
    { _id: owner._id, "payments.id": paymentId },
    {
      ...change({
        actor: "staff",
        by,
        kind: "payment-removed",
        message: `Payment of ${formatMoney(p.amount, p.currency)} dated ${p.receivedOn} removed.`,
      }),
      $pull: { payments: { id: paymentId } },
    } as UpdateFilter<BookingDoc>,
  );
  return res.modifiedCount ? ok(owner._id) : fail("That payment was already removed.");
}

export async function addNote(bookingId: string, text: string, by: Actor): Promise<Result> {
  const d = await getDb();
  const res = await d.bookings.updateOne({ _id: bookingId }, change({ actor: "staff", by, kind: "note", message: text }));
  return res.matchedCount ? ok(undefined) : fail("That booking no longer exists.");
}

/** Issue a new private link. The old one stops working immediately. */
export async function regenerateLink(bookingId: string, by: Actor): Promise<Result> {
  const d = await getDb();
  const res = await d.bookings.updateOne(
    { _id: bookingId },
    change(
      { actor: "staff", by, kind: "link", message: "Traveller link replaced; the previous one no longer works." },
      { $set: { accessToken: token() } },
    ),
  );
  return res.matchedCount ? ok(undefined) : fail("That booking no longer exists.");
}

export async function emailLink(bookingId: string, by: Actor): Promise<Result> {
  const d = await getDb();
  const b = await d.bookings.findOne({ _id: bookingId }, WITHOUT_ARRAYS);
  if (!b) return fail("That booking no longer exists.");
  const sent = await sendMail({
    to: b.email,
    replyTo: staffInbox() ?? undefined,
    subject: `Your booking ${b.reference} — ${company.shortName}`,
    text: [
      `Dear ${b.leadName},`,
      "",
      `You can follow your booking for ${b.journeyName} here:`,
      travellerLink(b.accessToken),
      "",
      "That link is private to you.",
      "",
      `— ${company.legalName}`,
    ].join("\n"),
  });
  if (!sent) return fail("Email is not set up on this site yet, so nothing was sent. Copy the link and send it yourself.");
  await d.bookings.updateOne(
    { _id: bookingId },
    change({ actor: "staff", by, kind: "email", message: "Booking link emailed to the traveller." }),
  );
  return ok(undefined);
}

// ── The dashboard ─────────────────────────────────────────────────────────

export async function dashboard() {
  const d = await getDb();
  const today = todayInNepal();
  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  const [byStatus, upcoming, recent, newEnquiries] = await Promise.all([
    d.bookings.aggregate<{ _id: BookingStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    d.bookings
      .find(
        { status: { $in: ["accepted", "confirmed"] }, startDate: { $gte: today, $lte: horizon } },
        WITHOUT_ARRAYS,
      )
      .sort({ startDate: 1 })
      .limit(12)
      .toArray(),
    // Only the twelve most recently touched bookings can hold the twelve most
    // recent events — see `change()` — so the unwind stays small however many
    // bookings there are.
    d.bookings
      .aggregate<{ _id: string; reference: string; event: BookingEvent }>([
        { $sort: { updatedAt: -1 } },
        { $limit: 12 },
        { $project: { reference: 1, event: "$events" } },
        { $unwind: "$event" },
        { $sort: { "event.at": -1 } },
        { $limit: 12 },
      ])
      .toArray(),
    d.enquiries.countDocuments({ status: "new" }),
  ]);

  const counts = Object.fromEntries(byStatus.map((r) => [r._id, r.n])) as Partial<Record<BookingStatus, number>>;
  return {
    counts,
    upcoming: upcoming.map(toBooking),
    recent: recent.map((r) => ({
      event: { ...r.event, bookingId: r._id },
      reference: r.reference,
      staffName: r.event.staffName,
    })),
    newEnquiries,
  };
}

/**
 * Customers, as the bookings describe them — there is no separate customer
 * collection to drift out of step. One row per email address.
 */
export async function customers(q?: string) {
  const d = await getDb();
  const re = q ? literal(q) : null;
  const firstPresent = (field: string) => ({
    $first: { $filter: { input: field, cond: { $ne: ["$$this", null] } } },
  });
  return d.bookings
    .aggregate<{
      email: string;
      name: string;
      phone: string | null;
      country: string | null;
      total: number;
      confirmed: number;
      last: Date;
    }>([
      ...(re ? [{ $match: { $or: [{ email: re }, { leadName: re }] } }] : []),
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$email",
          name: { $first: "$leadName" },
          phones: { $push: "$phone" },
          countries: { $push: "$country" },
          total: { $sum: 1 },
          confirmed: { $sum: { $cond: [{ $in: ["$status", ["confirmed", "completed"]] }, 1, 0] } },
          last: { $max: "$createdAt" },
        },
      },
      { $sort: { last: -1 } },
      { $limit: 500 },
      {
        $project: {
          _id: 0,
          email: "$_id",
          name: 1,
          phone: { $ifNull: [firstPresent("$phones"), null] },
          country: { $ifNull: [firstPresent("$countries"), null] },
          total: 1,
          confirmed: 1,
          last: 1,
        },
      },
    ])
    .toArray();
}

// ── Enquiries ─────────────────────────────────────────────────────────────

export interface NewEnquiry {
  name: string;
  email: string;
  phone: string | null;
  travellers: number | null;
  preferredStart: string | null;
  duration: string | null;
  journeySlug: string | null;
  destinationSlugs: string[] | null;
  experiences: string[] | null;
  message: string | null;
  itinerary: string | null;
}

export async function createEnquiry(input: NewEnquiry): Promise<Enquiry> {
  const d = await getDb();
  return withReference("EN", async (ref) => {
    const now = new Date();
    const doc: EnquiryDoc = {
      _id: randomUUID(),
      reference: ref,
      status: "new",
      ...input,
      email: input.email.toLowerCase(),
      bookingId: null,
      handledBy: null,
      handledByName: null,
      createdAt: now,
      updatedAt: now,
    };
    await d.enquiries.insertOne(doc);
    return toEnquiry(doc);
  });
}

export async function countNewEnquiries(): Promise<number> {
  const d = await getDb();
  return d.enquiries.countDocuments({ status: "new" });
}

export async function listEnquiries(status?: EnquiryStatus | "all"): Promise<Enquiry[]> {
  const d = await getDb();
  const rows = await d.enquiries
    .find(status && status !== "all" ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(300)
    .toArray();
  return rows.map(toEnquiry);
}

export async function enquiryDetail(id: string): Promise<Enquiry | null> {
  const d = await getDb();
  const row = await d.enquiries.findOne({ _id: id });
  return row ? toEnquiry(row) : null;
}

export async function setEnquiryStatus(id: string, status: EnquiryStatus, by: Actor): Promise<Result> {
  const d = await getDb();
  const res = await d.enquiries.updateOne(
    { _id: id },
    { $set: { status, handledBy: by.staffId, handledByName: by.staffName, updatedAt: new Date() } },
  );
  return res.matchedCount ? ok(undefined) : fail("That enquiry no longer exists.");
}

/** Open a booking from an enquiry, carrying across everything that maps. */
export async function convertEnquiry(
  id: string,
  journey: { slug: string | null; name: string },
  by: Actor,
): Promise<Result<string>> {
  const d = await getDb();
  const e = await d.enquiries.findOne({ _id: id });
  if (!e) return fail("That enquiry no longer exists.");
  if (e.bookingId) return ok(e.bookingId);

  const notes = [
    e.preferredStart && `Preferred start: ${e.preferredStart}`,
    e.duration && `Time available: ${e.duration}`,
    e.message,
    e.itinerary && `Planner:\n${e.itinerary}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const booking = await createBooking(
    {
      journeySlug: journey.slug,
      journeyName: journey.name,
      // The enquiry form asks for a month; a booking needs a date, so it is
      // left for staff to set rather than invented as the 1st.
      startDate: null,
      flexibleDates: true,
      travellers: e.travellers ?? 1,
      leadName: e.name,
      email: e.email,
      phone: e.phone,
      country: null,
      travellerNotes: notes || null,
      source: "enquiry",
      enquiryId: e._id,
    },
    by,
  );

  await d.enquiries.updateOne(
    { _id: id },
    {
      $set: {
        status: "converted",
        bookingId: booking.id,
        handledBy: by.staffId,
        handledByName: by.staffName,
        updatedAt: new Date(),
      },
    },
  );
  return ok(booking.id);
}
