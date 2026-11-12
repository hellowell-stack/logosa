import type { BookingStatus, EnquiryStatus, PaymentMethod } from "@/lib/db/schema";

/**
 * THE BOOKING LIFECYCLE.
 *
 *   requested ──quote──▶ quoted ──traveller accepts──▶ accepted ──staff──▶ confirmed ──▶ completed
 *                          │  ▲                                               ▲
 *                          │  └──revise──┘                                   │
 *                          └──traveller declines──▶ declined ──re-quote──┘ (back to quoted)
 *
 *   anything still open ──staff──▶ cancelled
 *
 * Staff may also confirm straight from `quoted`: a traveller who accepts on the
 * phone or in an email reply has accepted, whether or not they clicked the
 * button. The rules live here, in one module both sides import, so the admin
 * never offers an action the server would refuse.
 */

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "requested",
  "quoted",
  "accepted",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
];

export const isBookingStatus = (v: unknown): v is BookingStatus =>
  typeof v === "string" && (BOOKING_STATUSES as readonly string[]).includes(v);

/** How staff see it. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "New request",
  quoted: "Quote sent",
  accepted: "Accepted — awaiting deposit",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** How the traveller sees it: what has happened, and what happens next. */
export const STATUS_FOR_TRAVELLER: Record<BookingStatus, { title: string; next: string }> = {
  requested: {
    title: "Request received",
    next: "A person at Logosa will read your request and reply with a quote for your group. Nothing is charged until you have accepted it.",
  },
  quoted: {
    title: "Your quote is ready",
    next: "Read it through below. If it is right, accept it and we will send deposit instructions; if not, decline or reply to our email and we will revise it.",
  },
  accepted: {
    title: "Quote accepted",
    next: "Thank you. We will send deposit instructions by email. Your booking is confirmed once the deposit has been received.",
  },
  confirmed: {
    title: "Booking confirmed",
    next: "Your trip is confirmed. We will be in touch before departure with the final arrangements.",
  },
  completed: {
    title: "Trip completed",
    next: "Thank you for travelling with Logosa.",
  },
  declined: {
    title: "Quote declined",
    next: "You declined this quote. If you would like a different arrangement, reply to our email and we will look at it again.",
  },
  cancelled: {
    title: "Booking cancelled",
    next: "This booking has been cancelled. If you think that is a mistake, contact us.",
  },
};

/** Visual weight, not meaning — the admin maps each to a colour. */
export type Tone = "new" | "waiting" | "good" | "done" | "stopped";
export const STATUS_TONE: Record<BookingStatus, Tone> = {
  requested: "new",
  quoted: "waiting",
  accepted: "waiting",
  confirmed: "good",
  completed: "done",
  declined: "stopped",
  cancelled: "stopped",
};

export const OPEN_STATUSES: readonly BookingStatus[] = ["requested", "quoted", "accepted", "confirmed"];

export const can = {
  quote: (s: BookingStatus) => s === "requested" || s === "quoted" || s === "declined",
  respond: (s: BookingStatus) => s === "quoted",
  confirm: (s: BookingStatus) => s === "quoted" || s === "accepted",
  complete: (s: BookingStatus) => s === "confirmed",
  cancel: (s: BookingStatus) => (OPEN_STATUSES as readonly string[]).includes(s),
  pay: (s: BookingStatus) => s !== "cancelled" && s !== "declined",
};

/** True once the quote's validity date has passed (compared in Nepal's calendar). */
export const quoteExpired = (validUntil: string | null, today: string) =>
  Boolean(validUntil && validUntil < today);

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "bank-transfer",
  "cash",
  "card",
  "esewa",
  "khalti",
  "other",
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  "bank-transfer": "Bank transfer",
  cash: "Cash",
  card: "Card",
  esewa: "eSewa",
  khalti: "Khalti",
  other: "Other",
};

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);

export const ENQUIRY_STATUSES: readonly EnquiryStatus[] = ["new", "replied", "closed", "converted"];

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  replied: "Replied",
  closed: "Closed",
  converted: "Became a booking",
};

export const isEnquiryStatus = (v: unknown): v is EnquiryStatus =>
  typeof v === "string" && (ENQUIRY_STATUSES as readonly string[]).includes(v);
