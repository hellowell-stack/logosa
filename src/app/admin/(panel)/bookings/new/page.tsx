import type { Metadata } from "next";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import BookingFields from "@/components/admin/BookingFields";
import { PageTitle, Panel } from "@/components/admin/ui";
import Field from "@/components/forms/Field";
import { createBookingAction } from "@/app/admin/_actions/bookings";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New booking" };

/** For a booking that starts on the phone, over email, or at the office door. */
export default async function NewBookingPage() {
  await requireStaff();
  return (
    <>
      <PageTitle kicker="Bookings" title="New booking" />
      <Panel title="Trip and lead traveller" className="max-w-3xl">
        <ActionForm action={createBookingAction}>
          <BookingFields />
          <div className="mt-5">
            <Field label="Notes from the traveller" hint="Optional — what they asked for">
              <textarea name="notes" rows={4} className="field resize-y" />
            </Field>
          </div>
          <p className="mt-5 text-micro leading-relaxed text-ink-faint">
            The traveller is not emailed when you open a booking yourself. Send them their link from
            the booking once it is ready.
          </p>
          <div className="mt-6">
            <Submit busy="Creating…">Create booking</Submit>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
