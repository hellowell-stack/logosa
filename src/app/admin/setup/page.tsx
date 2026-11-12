import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthFrame from "@/components/admin/AuthFrame";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import Field from "@/components/forms/Field";
import { setupOwner } from "@/app/admin/_actions/auth";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { staffCount } from "@/lib/auth/staff";
import { databaseConfigured } from "@/lib/db";

export const metadata: Metadata = { title: "First-time setup" };

/**
 * Creates the first owner account, and then never again: once any account
 * exists this page only redirects to sign-in.
 */
export default async function SetupPage() {
  // Nothing here reads a cookie or header, so without this Next would render
  // the page once at build time and bake in the answer to "is there an owner
  // yet?". It has to be asked on every request.
  await connection();
  if (!databaseConfigured()) redirect("/admin/login");
  if ((await staffCount()) > 0) redirect("/admin/login");
  const production = process.env.NODE_ENV === "production";

  return (
    <AuthFrame
      title="Create the owner account"
      intro={
        <>
          This is the first account on the booking desk. It can add everyone else.
          {production && (
            <>
              {" "}
              To prove this is your deployment, enter the <code>ADMIN_SETUP_TOKEN</code> you set in
              the environment.
            </>
          )}
        </>
      }
    >
      <ActionForm action={setupOwner} className="space-y-6">
        {production && (
          <Field label="Setup token">
            <input name="setupToken" type="password" autoComplete="off" required className="field" />
          </Field>
        )}
        <Field label="Your name">
          <input name="name" autoComplete="name" required className="field" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required className="field" />
        </Field>
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters`}>
          <input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className="field" />
        </Field>
        <Field label="Password again">
          <input name="confirm" type="password" autoComplete="new-password" required className="field" />
        </Field>
        <div className="pt-2">
          <Submit busy="Creating…">Create account</Submit>
        </div>
      </ActionForm>
    </AuthFrame>
  );
}
