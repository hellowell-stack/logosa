"use client";

import { useActionState } from "react";
import Field from "@/components/forms/Field";
import { requestBooking, type BookState } from "@/app/(site)/book/actions";

/**
 * The booking request. It books nothing by itself: it asks for a quote on a
 * real date for a real group, and says so on the button. What a traveller is
 * committing to at this point is a reply, not a payment.
 */
export default function BookingForm({
  journeys,
  initialJourney,
  minDate,
}: {
  journeys: { slug: string; name: string; days: number }[];
  initialJourney?: string;
  /** Tomorrow, in Nepal's calendar. */
  minDate: string;
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(requestBooking, undefined);
  const err = state?.errors;
  const v = state?.values;
  const cls = (k: string) => `field ${err?.[k] ? "field-invalid" : ""}`;

  return (
    <form action={action} noValidate>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Journey" required error={err?.journey}>
            <select
              name="journey"
              defaultValue={v?.journey ?? initialJourney ?? ""}
              className={cls("journey")}
              required
            >
              <option value="" disabled>
                Choose a journey…
              </option>
              {journeys.map((j) => (
                <option key={j.slug} value={j.slug}>
                  {j.name} · {j.days} days
                </option>
              ))}
              <option value="custom">A custom trip — I will describe it below</option>
            </select>
          </Field>
        </div>

        <Field label="Start date" required error={err?.startDate}>
          <input
            name="startDate"
            type="date"
            min={minDate}
            defaultValue={v?.startDate}
            className={cls("startDate")}
            required
          />
        </Field>

        <Field label="Travellers" required hint="Including you" error={err?.travellers}>
          <input
            name="travellers"
            type="number"
            min={1}
            max={40}
            inputMode="numeric"
            defaultValue={v?.travellers ?? "2"}
            className={cls("travellers")}
            required
          />
        </Field>

        <label className="flex items-center gap-3 md:col-span-2">
          <input
            name="flexible"
            type="checkbox"
            defaultChecked={v?.flexible === "on"}
            className="h-4 w-4 accent-[var(--color-ink)]"
          />
          <span className="text-small text-ink-soft">
            My dates are flexible by a few days either way
          </span>
        </label>

        <Field label="Your name" required error={err?.name}>
          <input name="name" autoComplete="name" defaultValue={v?.name} className={cls("name")} required />
        </Field>

        <Field label="Email" required error={err?.email}>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={v?.email}
            className={cls("email")}
            required
          />
        </Field>

        <Field label="Phone or WhatsApp" hint="Optional">
          <input name="phone" type="tel" autoComplete="tel" defaultValue={v?.phone} className="field" />
        </Field>

        <Field label="Country" hint="Optional">
          <input name="country" autoComplete="country-name" defaultValue={v?.country} className="field" />
        </Field>

        <div className="md:col-span-2">
          <Field label="Anything we should know" hint="Optional">
            <textarea
              name="notes"
              rows={5}
              defaultValue={v?.notes}
              className="field resize-y"
              placeholder="For a custom trip, what you have in mind. Otherwise: fitness, altitude experience, dietary needs, rooms, anything you would like arranged…"
            />
          </Field>
        </div>
      </div>

      {/* Honeypot */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <label>
          Do not fill this in
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state?.message && (
        <p role="alert" className="mt-6 border-l-2 border-[var(--color-terracotta)] pl-4 text-small leading-relaxed text-ink">
          {state.message}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Sending…" : "Send booking request"}
        </button>
        <span className="text-small text-ink-faint">Nothing is charged at this step.</span>
      </div>

      <p className="mt-5 max-w-lg text-micro leading-relaxed text-ink-faint">
        We use what you send here to arrange your trip and nothing else. No mailing list, no third
        parties.
      </p>
    </form>
  );
}
