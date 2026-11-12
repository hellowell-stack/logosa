/**
 * Money, as the booking desk handles it: integer minor units plus a currency.
 *
 * Every currency here has two decimal places, which keeps the conversion to
 * and from minor units a single factor of 100. Adding a zero-decimal currency
 * (JPY) would mean carrying the exponent per currency — do that here, not at
 * the call sites.
 */

export const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "INR", "NPR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency =>
  typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/**
 * "1,250.50" → 125050. Accepts thousands separators and at most two decimal
 * places; anything else is rejected rather than guessed at, because a quote
 * that silently reads "1.250,00" as 1.25 is a very expensive bug.
 */
export function toMinor(input: string): number | undefined {
  const s = input.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const [whole, frac = ""] = s.split(".");
  const n = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : undefined;
}

/** 125050 → "1250.50", for prefilling an input. */
export const fromMinor = (minor: number): string => (minor / 100).toFixed(2);

/** 125050, "USD" → "$1,250.50" */
export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      currencyDisplay: currency === "NPR" || currency === "INR" ? "code" : "symbol",
    }).format(minor / 100);
  } catch {
    return `${currency} ${fromMinor(minor)}`;
  }
}
