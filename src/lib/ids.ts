import { createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Identifiers a person reads out loud, and tokens nobody ever should.
 */

// No 0/O, 1/I/L, 5/S or 8/B: references get read over the phone and copied
// from handwriting, and every ambiguous pair removed is one fewer wrong lookup.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY234679";

/** "LG-7KQ3P9" — a booking. "EN-…" — an enquiry. */
export function reference(prefix: "LG" | "EN"): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${out}`;
}

/** 256 bits, URL-safe. For the traveller's booking link and session cookies. */
export const token = (): string => randomBytes(32).toString("base64url");

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
