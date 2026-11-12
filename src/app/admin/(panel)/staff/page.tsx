import type { Metadata } from "next";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { PageTitle, Panel, when } from "@/components/admin/ui";
import Field from "@/components/forms/Field";
import {
  addStaffAction,
  resetStaffPasswordAction,
  setStaffActiveAction,
  setStaffRoleAction,
} from "@/app/admin/_actions/staff";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { requireOwner } from "@/lib/auth/session";
import { listStaff } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Staff" };

/**
 * Who can sign in. Owners manage this page; staff can do everything else.
 * There are no invitation emails — an owner sets a first password and passes
 * it on, and the new person changes it under Account.
 */
export default async function StaffPage() {
  const me = await requireOwner();
  const people = await listStaff();

  return (
    <>
      <PageTitle title="Staff" />

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-4">
          {people.map((p) => (
            <Panel
              key={p.id}
              title={p.name}
              aside={
                <span className="text-micro text-ink-faint">
                  {p.role === "owner" ? "Owner" : "Staff"}
                  {!p.active && " · deactivated"}
                  {p.id === me.id && " · you"}
                </span>
              }
            >
              <p className="text-small text-ink">{p.email}</p>
              <p className="text-micro text-ink-faint">
                Last signed in {p.lastLoginAt ? when(p.lastLoginAt) : "never"} · added {when(p.createdAt)}
              </p>

              <div className="mt-4 flex flex-wrap items-start gap-3">
                <ActionForm action={setStaffRoleAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="role" value={p.role === "owner" ? "staff" : "owner"} />
                  <Submit ghost small busy="Saving…">
                    {p.role === "owner" ? "Make staff" : "Make owner"}
                  </Submit>
                </ActionForm>
                {p.id !== me.id && (
                  <ActionForm action={setStaffActiveAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                    <Submit ghost small danger={p.active} busy="Saving…">
                      {p.active ? "Deactivate" : "Reactivate"}
                    </Submit>
                  </ActionForm>
                )}
              </div>

              {p.id !== me.id && (
                <details className="mt-4">
                  <summary className="cursor-pointer list-none text-micro">
                    <span className="link-rule">Reset their password</span>
                  </summary>
                  <ActionForm action={resetStaffPasswordAction} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="New password" hint={`${PASSWORD_MIN}+ characters`} className="min-w-56 flex-1">
                      <input name="password" type="text" autoComplete="off" minLength={PASSWORD_MIN} required className="field" />
                    </Field>
                    <Submit ghost small busy="Resetting…">
                      Reset
                    </Submit>
                  </ActionForm>
                </details>
              )}
            </Panel>
          ))}
        </div>

        <div className="min-w-0">
          <Panel title="Add someone">
            <ActionForm action={addStaffAction} resetOnSuccess className="space-y-5">
              <Field label="Name">
                <input name="name" required className="field" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className="field" />
              </Field>
              <Field label="First password" hint={`${PASSWORD_MIN}+ characters — they change it`}>
                <input name="password" type="text" autoComplete="off" minLength={PASSWORD_MIN} required className="field" />
              </Field>
              <Field label="Role">
                <select name="role" defaultValue="staff" className="field">
                  <option value="staff">Staff — bookings, enquiries, customers</option>
                  <option value="owner">Owner — all of that, and this page</option>
                </select>
              </Field>
              <Submit busy="Adding…">Add</Submit>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
