/**
 * THE BOOKING DESK — document model (MongoDB).
 *
 * Four collections: staff, sessions, bookings, enquiries.
 *
 * A booking's payments and its history are embedded in the booking document
 * rather than kept in collections of their own. They are only ever read with
 * their booking, they are bounded (tens per booking, not thousands), and —
 * the real reason — it makes every change atomic without transactions: a
 * status change and the history entry that records it are one `updateOne` on
 * one document, so there is no state in which the booking moved and the
 * history does not say so.
 *
 * Ids are UUID strings rather than ObjectIds, so they read the same in URLs,
 * logs and exports, and nothing outside this layer needs to know the database
 * is Mongo. Calendar dates (start date, quote expiry, payment date) are
 * `YYYY-MM-DD` strings — they are dates on a calendar in Nepal, not instants —
 * and they sort correctly as strings. Money is integer minor units (cents,
 * paisa) next to an ISO currency code: never a float, never without its
 * currency.
 *
 * Statuses and roles are validated in `src/lib/bookings/status.ts` on every
 * write; the database stores what it is given.
 */

export const COLLECTIONS = {
  staff: "staff",
  sessions: "sessions",
  bookings: "bookings",
  enquiries: "enquiries",
} as const;

export type StaffRole = "owner" | "staff";

/** People who can sign in to /admin. There is no public account system. */
export interface StaffDoc {
  _id: string;
  /** Always stored lowercased. */
  email: string;
  name: string;
  passwordHash: string;
  role: StaffRole;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * A signed-in session. `_id` is the SHA-256 of the token in the cookie, so a
 * copy of this collection is not a set of working logins. Expired sessions
 * are deleted by a TTL index on `expiresAt`.
 */
export interface SessionDoc {
  _id: string;
  staffId: string;
  createdAt: Date;
  expiresAt: Date;
}

export type BookingStatus =
  | "requested"
  | "quoted"
  | "accepted"
  | "confirmed"
  | "completed"
  | "declined"
  | "cancelled";

export type BookingSource = "website" | "enquiry" | "staff";
export type PaymentMethod = "bank-transfer" | "cash" | "card" | "esewa" | "khalti" | "other";
export type EventActor = "traveller" | "staff" | "system";

/**
 * Money received against a booking. Recorded by staff: the site takes no
 * payments itself, so every entry is a statement about a transfer that has
 * already happened somewhere else.
 */
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  receivedOn: string;
  /** Bank reference, receipt number, transaction id. Staff only. */
  reference: string | null;
  note: string | null;
  recordedBy: string | null;
  /** As they were named when they recorded it — this is an audit trail. */
  recordedByName: string | null;
  createdAt: Date;
}

/**
 * One thing that happened to a booking. Most entries are staff-only; those
 * marked `public` also appear on the traveller's page.
 */
export interface BookingEvent {
  id: string;
  at: Date;
  actor: EventActor;
  staffId: string | null;
  staffName: string | null;
  kind: string;
  message: string;
  public: boolean;
}

export interface BookingFields {
  /** Human reference, quoted on the phone and in email subjects: LG-7KQ3P9. */
  reference: string;
  /**
   * The traveller's private link is /booking/<accessToken>. Stored in the
   * clear on purpose: staff need to be able to send it again, and all it opens
   * is this booking's own details.
   */
  accessToken: string;
  status: BookingStatus;
  source: BookingSource;

  // ── The trip ──
  /** Null for a custom trip. */
  journeySlug: string | null;
  /** Snapshotted, so a journey renamed or unpublished later does not rewrite history. */
  journeyName: string;
  startDate: string | null;
  flexibleDates: boolean;
  travellers: number;

  // ── The lead traveller ──
  leadName: string;
  email: string;
  phone: string | null;
  country: string | null;
  travellerNotes: string | null;

  // ── The quote ──
  currency: string | null;
  quoteTotal: number | null;
  depositAmount: number | null;
  /** What the price covers and excludes, written by staff, shown to the traveller. */
  quoteNotes: string | null;
  quoteValidUntil: string | null;

  // ── Lifecycle stamps ──
  quotedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;

  enquiryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingDoc extends BookingFields {
  _id: string;
  payments: Payment[];
  events: BookingEvent[];
}

/** A booking as the rest of the app sees it: `id`, and no embedded arrays. */
export type Booking = BookingFields & { id: string };

export type EnquiryStatus = "new" | "replied" | "closed" | "converted";

/** Everything the contact and planner forms send, kept even when email is not set up. */
export interface EnquiryDoc {
  _id: string;
  reference: string;
  status: EnquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  travellers: number | null;
  /** As the visitor gave it — a month, usually — not a date. */
  preferredStart: string | null;
  duration: string | null;
  journeySlug: string | null;
  destinationSlugs: string[] | null;
  experiences: string[] | null;
  message: string | null;
  itinerary: string | null;
  bookingId: string | null;
  handledBy: string | null;
  handledByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Enquiry = Omit<EnquiryDoc, "_id"> & { id: string };
