import type { Metadata } from "next";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { PageTitle, Panel } from "@/components/admin/ui";
import Field from "@/components/forms/Field";
import { changeOwnPassword } from "@/app/admin/_actions/auth";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <>
      <PageTitle kicker={me.role === "owner" ? "Owner" : "Staff"} title={me.name} />
      <p className="-mt-3 mb-8 text-small text-ink-soft">{me.email}</p>

      <Panel title="Change your password" className="max-w-lg">
        <ActionForm action={changeOwnPassword} resetOnSuccess className="space-y-5">
          <Field label="Current password">
            <input name="current" type="password" autoComplete="current-password" required className="field" />
          </Field>
          <Field label="New password" hint={`At least ${PASSWORD_MIN} characters`}>
            <input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className="field" />
          </Field>
          <Field label="New password again">
            <input name="confirm" type="password" autoComplete="new-password" required className="field" />
          </Field>
          <Submit busy="Changing…">Change password</Submit>
        </ActionForm>
      </Panel>
    </>
  );
}
