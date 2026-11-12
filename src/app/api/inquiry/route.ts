import { NextResponse } from "next/server";
import { journeyBySlug } from "@/data/journeys";
import { destinationBySlug } from "@/data/destinations";
import { databaseConfigured } from "@/lib/db";
import { createEnquiry } from "@/lib/bookings/service";
import { mailConfigured, sendMail, staffInbox } from "@/lib/mail";
import { limited } from "@/lib/rate-limit";
import { EMAIL, clean, clientIp, int } from "@/lib/validate";

/**
 * ENQUIRIES
 *
 * Every enquiry is recorded in the database first, where it appears in the
 * admin under Enquiries. It is then also delivered, if a channel is set up:
 *
 *   RESEND_API_KEY + INQUIRY_TO   → emailed via Resend
 *   INQUIRY_WEBHOOK_URL           → POSTed as JSON (Zapier, Make, a CRM…)
 *
 * The response's `delivered` is true when at least one of those three things
 * actually happened. When none did — no database, no mail, no webhook — it is
 * false, and the form says so and hands the visitor a route that works
 * instead. It never reports success for a message that went nowhere.
 */

export const runtime = "nodejs";

/**
 * What InquiryForm sends. `date`, `journey`, `destination` and `itinerary` are
 * the names this route originally read; they are still accepted so that
 * nothing already posting to it breaks.
 */
interface Payload {
  name?: string;
  email?: string;
  phone?: string;
  travellers?: number;
  startDate?: string;
  date?: string;
  duration?: string;
  message?: string;
  journeySlug?: string;
  journey?: string;
  destinationSlugs?: string[];
  destination?: string;
  experiences?: string[];
  itinerary?: string;
  /** Honeypot — must be empty. */
  website?: string;
}

const list = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map((x) => clean(x, 80)).filter(Boolean).slice(0, max) : [];

export async function POST(request: Request) {
  if (limited(`inquiry:${clientIp(request.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Too many enquiries from this connection. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  // Bots fill every field they find. A human never sees this one.
  if (clean(body.website, 100)) {
    return NextResponse.json({ ok: true, delivered: true });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 60);
  const message = clean(body.message, 4000);
  const itinerary = clean(body.itinerary, 4000);
  const preferredStart = clean(body.startDate ?? body.date, 40);
  const duration = clean(body.duration, 80);
  const travellers = int(body.travellers, 1, 40);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please tell us your name.";
  if (!EMAIL.test(email)) errors.email = "Please give an email address we can reply to.";
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Resolve references against real data, so staff never receive a slug that
  // does not correspond to anything.
  const journey = journeyBySlug(clean(body.journeySlug ?? body.journey, 80));
  const destinations = [...list(body.destinationSlugs), clean(body.destination, 80)]
    .map((s) => destinationBySlug(s))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const experiences = list(body.experiences);

  // ── Record ──────────────────────────────────────────────────────────────
  let reference: string | undefined;
  if (databaseConfigured()) {
    try {
      const row = await createEnquiry({
        name,
        email,
        phone: phone || null,
        travellers: travellers ?? null,
        preferredStart: preferredStart || null,
        duration: duration || null,
        journeySlug: journey?.slug ?? null,
        destinationSlugs: destinations.length ? destinations.map((d) => d.slug) : null,
        experiences: experiences.length ? experiences : null,
        message: message || null,
        itinerary: itinerary || null,
      });
      reference = row.reference;
    } catch (err) {
      // Carry on to email: a database outage should not also cost the enquiry.
      console.error("[inquiry] could not record:", err);
    }
  }

  const summary = [
    "LOGOSA — WEBSITE ENQUIRY",
    "".padEnd(46, "="),
    reference ? `Reference:   ${reference}` : null,
    `Received:    ${new Date().toISOString()}`,
    journey ? `Journey:     ${journey.name} (${journey.days} days, ${journey.difficulty})` : null,
    destinations.length ? `Places:      ${destinations.map((d) => d.name).join(", ")}` : null,
    experiences.length ? `Interests:   ${experiences.join(", ")}` : null,
    travellers ? `Travellers:  ${travellers}` : null,
    preferredStart ? `Preferred:   ${preferredStart}` : null,
    duration ? `Time:        ${duration}` : null,
    "",
    "CONTACT",
    "".padEnd(46, "-"),
    `Name:        ${name}`,
    `Email:       ${email}`,
    phone ? `Phone:       ${phone}` : null,
    message ? ["", "MESSAGE", "".padEnd(46, "-"), message].join("\n") : null,
    itinerary ? ["", "PLANNER OUTPUT", "".padEnd(46, "-"), itinerary].join("\n") : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  // ── Deliver ─────────────────────────────────────────────────────────────
  let sent = false;
  const to = staffInbox();
  if (mailConfigured() && to) {
    const subjectParts = [journey?.name, ...destinations.map((d) => d.name)].filter(Boolean).slice(0, 2).join(" · ");
    sent = await sendMail({
      to,
      replyTo: email,
      subject: `Enquiry${reference ? ` ${reference}` : ""}: ${subjectParts || "General"} — ${name}`,
      text: summary,
    });
  }

  if (process.env.INQUIRY_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.INQUIRY_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference ?? null,
          receivedAt: new Date().toISOString(),
          name,
          email,
          phone: phone || null,
          travellers: travellers ?? null,
          date: preferredStart || null,
          duration: duration || null,
          journey: journey?.slug ?? null,
          journeyName: journey?.name ?? null,
          destinations: destinations.map((d) => d.slug),
          experiences,
          message: message || null,
          itinerary: itinerary || null,
          summary,
        }),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      sent = true;
    } catch (err) {
      console.error("[inquiry] webhook failed:", err);
    }
  }

  const delivered = Boolean(reference) || sent;
  if (!delivered) {
    console.warn("[inquiry] Not recorded or delivered — set MONGODB_URI, or RESEND_API_KEY + INQUIRY_TO, or INQUIRY_WEBHOOK_URL.");
    console.info("[inquiry] enquiry follows:\n" + summary);
  }

  return NextResponse.json({ ok: true, delivered, reference: reference ?? null, summary: delivered ? undefined : summary });
}
