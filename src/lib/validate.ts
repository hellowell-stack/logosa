/**
 * Input handling shared by every form on the site — the enquiry route, the
 * booking request, and the admin. Everything a visitor or a staff member sends
 * is untrusted until it has been through here.
 */

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trim, cap length, and strip control characters (newlines and tabs kept). */
export const clean = (v: unknown, max: number): string =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** A FormData field, cleaned. */
export const field = (fd: FormData, name: string, max = 200): string => clean(fd.get(name), max);

/** A whole number within bounds, or undefined. */
export function int(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** An ISO calendar date (YYYY-MM-DD) that actually exists, or undefined. */
export function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

/** Today's date in Nepal (UTC+5:45), which is the calendar Logosa works to. */
export function todayInNepal(): string {
  return new Date(Date.now() + (5 * 60 + 45) * 60_000).toISOString().slice(0, 10);
}

/** The client's address, as far as the proxy chain will say. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
