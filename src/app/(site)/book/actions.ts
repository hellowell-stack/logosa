"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publishedJourneys } from "@/data/journeys";
import { databaseConfigured } from "@/lib/db";
import { createBooking } from "@/lib/bookings/service";
import { limited } from "@/lib/rate-limit";
import { EMAIL, clientIp, field, int, isoDate, todayInNepal } from "@/lib/validate";

export type BookState =
  | {
      message?: string;
      errors?: Record<string, string>;
      /** Echoed back so a rejected form does not lose what was typed. */
      values?: Record<string, string>;
    }
  | undefined;

/**
 * A traveller's booking request. Public and unauthenticated, so it is treated
 * like any other open endpoint: rate-limited, honeypotted, and every field
 * validated here regardless of what the browser already checked.
 */
export async function requestBooking(_prev: BookState, fd: FormData): Promise<BookState> {
  if (!databaseConfigured()) {
    return { message: "Online booking is not switched on yet. Please send an enquiry instead." };
  }
  if (limited(`book:${clientIp(await headers())}`, 5, 10 * 60_000)) {
    return { message: "Too many requests from this connection. Please try again in a few minutes." };
  }
  // Bots fill every field they find; a person never sees this one.
  if (field(fd, "website")) redirect("/");

  const values = {
    journey: field(fd, "journey", 80),
    startDate: field(fd, "startDate", 10),
    flexible: fd.get("flexible") ? "on" : "",
    travellers: field(fd, "travellers", 3),
    name: field(fd, "name", 120),
    email: field(fd, "email", 200),
    phone: field(fd, "phone", 60),
    country: field(fd, "country", 80),
    notes: field(fd, "notes", 4000),
  };

  const errors: Record<string, string> = {};
  // Only journeys the public site actually offers can be booked by slug.
  const journey =
    values.journey && values.journey !== "custom"
      ? publishedJourneys.find((j) => j.slug === values.journey)
      : undefined;
  if (values.journey !== "custom" && !journey) errors.journey = "Choose a journey, or a custom trip.";

  const startDate = isoDate(values.startDate);
  if (!startDate) errors.startDate = "Choose the day you would like to start.";
  else if (startDate <= todayInNepal()) errors.startDate = "That date has already passed in Nepal.";

  const travellers = int(values.travellers, 1, 40);
  if (!travellers) errors.travellers = "How many of you are travelling?";
  if (values.name.length < 2) errors.name = "Please tell us your name.";
  if (!EMAIL.test(values.email)) errors.email = "Please give an email address we can reply to.";

  if (Object.keys(errors).length) {
    return { errors, values, message: "Please check the highlighted fields." };
  }

  const booking = await createBooking({
    journeySlug: journey?.slug ?? null,
    journeyName: journey?.name ?? "Custom trip",
    startDate: startDate!,
    flexibleDates: Boolean(values.flexible),
    travellers: travellers!,
    leadName: values.name,
    email: values.email,
    phone: values.phone || null,
    country: values.country || null,
    travellerNotes: values.notes || null,
    source: "website",
  });

  redirect(`/booking/${booking.accessToken}?new=1`);
}
