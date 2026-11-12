import Link from "next/link";
import type { BookingStatus, EnquiryStatus } from "@/lib/db/schema";
import { ENQUIRY_STATUS_LABEL, STATUS_LABEL, STATUS_TONE, type Tone } from "@/lib/bookings/status";

/**
 * The admin's small vocabulary of parts. Same paper, ink and type as the public
 * site — a booking desk for this company should look like it belongs to it —
 * set tighter, because here the job is scanning a list, not reading a page.
 */

const TONE: Record<Tone, string> = {
  new: "bg-gold text-ink",
  waiting: "border border-ink text-ink",
  good: "bg-pine text-paper",
  done: "bg-paper-3 text-ink-soft",
  stopped: "border border-terracotta text-terracotta",
};

const badge = "inline-block whitespace-nowrap px-2 py-1 text-[0.625rem] font-semibold uppercase leading-none tracking-[0.12em]";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`${badge} ${TONE[STATUS_TONE[status]]}`}>{STATUS_LABEL[status]}</span>;
}

const ENQUIRY_TONE: Record<EnquiryStatus, Tone> = { new: "new", replied: "waiting", closed: "done", converted: "good" };
export function EnquiryBadge({ status }: { status: EnquiryStatus }) {
  return <span className={`${badge} ${TONE[ENQUIRY_TONE[status]]}`}>{ENQUIRY_STATUS_LABEL[status]}</span>;
}

export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-rule)] pb-6">
      <div>
        {kicker && <p className="label text-gold-deep">{kicker}</p>}
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-display-s leading-tight">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}

export function Panel({
  title,
  children,
  className,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={`border border-[var(--color-rule)] bg-[color-mix(in_srgb,white_35%,transparent)] p-5 md:p-6 ${className ?? ""}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="label-slim text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-small text-ink-faint">{children}</p>;
}

/** A count that links to the list it counts. Set in the grotesque: a dashboard is read at a glance, and Bodoni's 1 is an I. */
export function Stat({ label, value, href, lit }: { label: string; value: number; href: string; lit?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-28 flex-col justify-between gap-3 border p-5 transition-colors hover:border-ink ${lit && value > 0 ? "border-gold bg-[color-mix(in_srgb,var(--color-gold)_12%,transparent)]" : "border-[var(--color-rule)]"}`}
    >
      <span className="label-slim">{label}</span>
      <span className="text-display-s font-medium leading-none tabular-nums text-ink">{value}</span>
    </Link>
  );
}

/** Horizontal filter tabs, as links, so a filtered list has a URL. */
export function Tabs({ items, current }: { items: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Filter" className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-rule)]">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-small transition-colors ${
            t.key === current ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink"
          }`}
        >
          {t.label}
          {t.count ? <span className="numeral ml-1.5 text-gold-deep">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

// ── Tables ─────────────────────────────────────────────────────────────────

export const th = "border-b border-ink px-3 py-2.5 text-left label-slim font-normal";
export const td = "border-b border-[var(--color-rule)] px-3 py-3 align-top text-small";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse">{children}</table>
    </div>
  );
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** "12 Oct 2026" — calendar dates are stored as plain YYYY-MM-DD. */
export const day = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";

/** "12 Oct, 14:05" in Kathmandu time, which is when the office sees it happen. */
export const when = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kathmandu",
      })
    : "—";
