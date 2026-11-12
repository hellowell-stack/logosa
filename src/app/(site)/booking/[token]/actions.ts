"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { respondToQuote } from "@/lib/bookings/service";
import { limited } from "@/lib/rate-limit";
import { clientIp, field } from "@/lib/validate";

export type AnswerState = { error?: string } | undefined;

/**
 * The traveller's answer to a quote. Authorised by possession of the booking
 * link alone — that token is the credential — so it is checked against the
 * database on every call, and the answer only lands if the booking is still
 * waiting for one.
 */
export async function answerQuote(_prev: AnswerState, fd: FormData): Promise<AnswerState> {
  const answer = field(fd, "answer", 10);
  if (answer !== "accept" && answer !== "decline") return { error: "Something went wrong. Please reload the page." };
  if (limited(`answer:${clientIp(await headers())}`, 10, 10 * 60_000)) {
    return { error: "Too many attempts from this connection. Please try again in a few minutes." };
  }

  const result = await respondToQuote(field(fd, "token", 64), answer);
  if (!result.ok) return { error: result.error };
  refresh();
  return undefined;
}
