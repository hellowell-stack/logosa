import "server-only";
import { company, confirmed } from "@/data/company";

/**
 * Outgoing email, via Resend when RESEND_API_KEY is set.
 *
 * Mail is never load-bearing here. Every booking and enquiry is in the
 * database before anything is sent, so a failed or unconfigured send loses a
 * notification, not a customer — the admin still shows everything. That is
 * why `sendMail` reports failure instead of throwing.
 */

/** Where staff notifications go. Accepts both names LAUNCH.md has used. */
export function staffInbox(): string | null {
  return (
    process.env.INQUIRY_TO ||
    process.env.INQUIRY_TO_EMAIL ||
    (confirmed(company.email) ? company.email : null)
  );
}

export const mailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY);

export async function sendMail(msg: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[mail] not configured — not sent: "${msg.subject}" → ${msg.to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.INQUIRY_FROM || "Logosa Website <onboarding@resend.dev>",
        to: [msg.to],
        reply_to: msg.replyTo,
        subject: msg.subject,
        text: msg.text,
      }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
    return true;
  } catch (err) {
    console.error(`[mail] send failed: "${msg.subject}" → ${msg.to}`, err);
    return false;
  }
}

/** A plain-text block with a rule under its heading, as every Logosa email is set. */
export const section = (title: string, lines: (string | null | undefined | false)[]): string =>
  [title.toUpperCase(), "".padEnd(46, "-"), ...lines.filter(Boolean)].join("\n");
