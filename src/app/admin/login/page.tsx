import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthFrame from "@/components/admin/AuthFrame";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import Field from "@/components/forms/Field";
import { login } from "@/app/admin/_actions/auth";
import { getSession } from "@/lib/auth/session";
import { staffCount } from "@/lib/auth/staff";
import { databaseConfigured } from "@/lib/db";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";

  if (!databaseConfigured()) {
    return (
      <AuthFrame
        title="Not set up yet"
        intro={
          <>
            The booking desk needs a MongoDB database. Set <code>MONGODB_URI</code> in the
            environment — LAUNCH.md §3 has the steps.
          </>
        }
      >
        {null}
      </AuthFrame>
    );
  }

  if (await getSession()) redirect("/admin");
  if ((await staffCount()) === 0) redirect("/admin/setup");

  return (
    <AuthFrame title="Sign in">
      <ActionForm action={login} className="space-y-6">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required autoFocus className="field" />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className="field" />
        </Field>
        <div className="pt-2">
          <Submit busy="Signing in…">Sign in</Submit>
        </div>
      </ActionForm>
      <p className="mt-8 text-micro leading-relaxed text-ink-faint">
        Forgotten your password? Ask an owner to reset it under Staff.
      </p>
    </AuthFrame>
  );
}
