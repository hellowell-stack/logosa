"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { journeyBySlug } from "@/data/journeys";
import { requireStaff, type SessionUser } from "@/lib/auth/session";
import * as svc from "@/lib/bookings/service";
import { isPaymentMethod } from "@/lib/bookings/status";
import { isCurrency, toMinor } from "@/lib/money";
import { EMAIL, field, int, isoDate, todayInNepal } from "@/lib/validate";
import { isUuid, type FormResult } from "@/lib/form-result";

/**
 * Every booking action a member of staff can take. Each one authenticates
 * itself first: a server action is a public POST endpoint whether or not the
 * page that renders its form is protected.
 */

const actor = (me: SessionUser) => ({ staffId: me.id, staffName: me.name });

/** Re-render every admin page, so lists and counts agree with the change. */
const done = (notice: string): FormResult => {
  revalidatePath("/admin", "layout");
  return { notice };
};

const bookingId = (fd: FormData) => {
  const id = field(fd, "id", 40);
  return isUuid(id) ? id : null;
};

/** The trip and traveller fields shared by "new booking" and "edit details". */
function readDetails(fd: FormData): { error: string } | { value: Omit<svc.NewBooking, "source" | "travellerNotes"> } {
  const slug = field(fd, "journey", 80);
  const journey = slug && slug !== "custom" ? journeyBySlug(slug) : undefined;
  if (slug && slug !== "custom" && !journey) return { error: "Choose a journey from the list, or a custom trip." };
  const customName = field(fd, "customName", 120);

  const rawDate = field(fd, "startDate", 10);
  const startDate = rawDate ? isoDate(rawDate) : undefined;
  if (rawDate && !startDate) return { error: "The start date is not a real date." };

  const travellers = int(field(fd, "travellers", 3), 1, 99);
  if (!travellers) return { error: "Give the number of travellers." };

  const leadName = field(fd, "leadName", 120);
  const email = field(fd, "email", 200);
  if (leadName.length < 2) return { error: "Give the lead traveller's name." };
  if (!EMAIL.test(email)) return { error: "Give a valid email address for the lead traveller." };

  return {
    value: {
      journeySlug: journey?.slug ?? null,
      journeyName: journey?.name ?? (customName || "Custom trip"),
      startDate: startDate ?? null,
      flexibleDates: Boolean(fd.get("flexible")),
      travellers,
      leadName,
      email,
      phone: field(fd, "phone", 60) || null,
      country: field(fd, "country", 80) || null,
    },
  };
}

export async function createBookingAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const details = readDetails(fd);
  if ("error" in details) return { error: details.error };

  const booking = await svc.createBooking(
    { ...details.value, travellerNotes: field(fd, "notes", 4000) || null, source: "staff" },
    actor(me),
  );
  revalidatePath("/admin", "layout");
  redirect(`/admin/bookings/${booking.id}`);
}

export async function updateDetailsAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };
  const details = readDetails(fd);
  if ("error" in details) return { error: details.error };

  const r = await svc.updateDetails(id, details.value, actor(me));
  return r.ok ? done("Details saved.") : { error: r.error };
}

export async function sendQuoteAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };

  const currency = field(fd, "currency", 3);
  if (!isCurrency(currency)) return { error: "Choose a currency." };
  const total = toMinor(field(fd, "total", 20));
  if (!total) return { error: "Enter the total as a number, e.g. 2450 or 2450.00." };
  const rawDeposit = field(fd, "deposit", 20);
  const deposit = rawDeposit ? toMinor(rawDeposit) : null;
  if (rawDeposit && deposit === undefined) return { error: "Enter the deposit as a number, or leave it blank." };
  if (deposit && deposit > total) return { error: "The deposit cannot be more than the total." };
  const rawValid = field(fd, "validUntil", 10);
  const validUntil = rawValid ? (isoDate(rawValid) ?? null) : null;
  if (rawValid && !validUntil) return { error: "The validity date is not a real date." };
  if (validUntil && validUntil < todayInNepal()) return { error: "The quote would already have expired." };

  const r = await svc.sendQuote(
    id,
    { currency, total, deposit: deposit ?? null, notes: field(fd, "notes", 6000) || null, validUntil, notify: Boolean(fd.get("notify")) },
    actor(me),
  );
  return r.ok ? done(fd.get("notify") ? "Quote saved and emailed to the traveller." : "Quote saved. The traveller has not been emailed.") : { error: r.error };
}

export async function setStatusAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };
  const to = field(fd, "to", 20);
  if (to !== "confirmed" && to !== "completed" && to !== "cancelled") return { error: "Unknown status." };

  const reason = field(fd, "reason", 500) || null;
  if (to === "cancelled" && !reason) return { error: "Give a reason for the cancellation — it goes on the record." };

  const r = await svc.setStatus(id, to, actor(me), { reason, notify: Boolean(fd.get("notify")) });
  const label = { confirmed: "Booking confirmed.", completed: "Marked as completed.", cancelled: "Booking cancelled." }[to];
  return r.ok ? done(label) : { error: r.error };
}

export async function recordPaymentAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };

  const amount = toMinor(field(fd, "amount", 20));
  if (!amount) return { error: "Enter the amount received, e.g. 500 or 500.00." };
  const currency = field(fd, "currency", 3);
  if (!isCurrency(currency)) return { error: "Choose a currency." };
  const method = field(fd, "method", 20);
  if (!isPaymentMethod(method)) return { error: "Choose how it was paid." };
  const receivedOn = isoDate(field(fd, "receivedOn", 10));
  if (!receivedOn) return { error: "Give the date the money arrived." };
  if (receivedOn > todayInNepal()) return { error: "That date is in the future. Record payments once they have arrived." };

  const r = await svc.recordPayment(
    id,
    { amount, currency, method, receivedOn, reference: field(fd, "reference", 120) || null, note: field(fd, "note", 500) || null },
    actor(me),
  );
  return r.ok ? done("Payment recorded.") : { error: r.error };
}

export async function deletePaymentAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const paymentId = field(fd, "paymentId", 40);
  if (!isUuid(paymentId)) return { error: "Unknown payment." };
  const r = await svc.deletePayment(paymentId, actor(me));
  return r.ok ? done("Payment removed.") : { error: r.error };
}

export async function addNoteAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };
  const text = field(fd, "note", 2000);
  if (!text) return { error: "Write the note first." };
  const r = await svc.addNote(id, text, actor(me));
  return r.ok ? done("Note added.") : { error: r.error };
}

export async function emailLinkAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };
  const r = await svc.emailLink(id, actor(me));
  return r.ok ? done("Link emailed to the traveller.") : { error: r.error };
}

export async function regenerateLinkAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = bookingId(fd);
  if (!id) return { error: "Unknown booking." };
  const r = await svc.regenerateLink(id, actor(me));
  return r.ok ? done("New link issued. The old one no longer works — send the traveller the new one.") : { error: r.error };
}
