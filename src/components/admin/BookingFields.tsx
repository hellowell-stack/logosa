import Field from "@/components/forms/Field";
import { journeys } from "@/data/journeys";

/**
 * Trip and lead-traveller fields, shared by "new booking" and "edit details"
 * so the two can never disagree about what a booking is. Staff see every
 * journey, drafts included — a route can be sold on the phone before its page
 * is published.
 */
export interface DetailValues {
  journeySlug: string | null;
  journeyName: string;
  startDate: string | null;
  flexibleDates: boolean;
  travellers: number;
  leadName: string;
  email: string;
  phone: string | null;
  country: string | null;
}

export default function BookingFields({ v }: { v?: DetailValues }) {
  const custom = v && !v.journeySlug;
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label="Journey" className="sm:col-span-2">
        <select name="journey" defaultValue={v ? (v.journeySlug ?? "custom") : ""} required className="field">
          <option value="" disabled>
            Choose…
          </option>
          {journeys.map((j) => (
            <option key={j.slug} value={j.slug}>
              {j.name} · {j.days} days{j.status === "draft" ? " (draft)" : ""}
            </option>
          ))}
          <option value="custom">Custom trip</option>
        </select>
      </Field>
      <Field label="Custom trip name" hint="Only for a custom trip" className="sm:col-span-2">
        <input name="customName" defaultValue={custom ? v.journeyName : ""} placeholder="e.g. Kathmandu and Chitwan, family of four" className="field" />
      </Field>
      <Field label="Start date" hint="Optional">
        <input name="startDate" type="date" defaultValue={v?.startDate ?? ""} className="field" />
      </Field>
      <Field label="Travellers">
        <input name="travellers" type="number" min={1} max={99} defaultValue={v?.travellers ?? 2} required className="field" />
      </Field>
      <label className="flex items-center gap-3 sm:col-span-2">
        <input name="flexible" type="checkbox" defaultChecked={v?.flexibleDates} className="h-4 w-4 accent-[var(--color-ink)]" />
        <span className="text-small text-ink-soft">Dates are flexible</span>
      </label>
      <Field label="Lead traveller">
        <input name="leadName" defaultValue={v?.leadName} required className="field" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={v?.email} required className="field" />
      </Field>
      <Field label="Phone" hint="Optional">
        <input name="phone" type="tel" defaultValue={v?.phone ?? ""} className="field" />
      </Field>
      <Field label="Country" hint="Optional">
        <input name="country" defaultValue={v?.country ?? ""} className="field" />
      </Field>
    </div>
  );
}
