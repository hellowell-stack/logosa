"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfigured } from "@/lib/db";
import { createSession, destroyAllSessions, destroySession, requireStaff } from "@/lib/auth/session";
import { dummyHash, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { createStaff, findStaff, findStaffByEmail, safeEqual, setPassword, staffCount } from "@/lib/auth/staff";
import { limited } from "@/lib/rate-limit";
import { EMAIL, clientIp, field } from "@/lib/validate";
import type { FormResult } from "@/lib/form-result";

const NO_DB = "The admin needs a database. Set MONGODB_URI — see LAUNCH.md §3.";
const password = (fd: FormData, name: string) => String(fd.get(name) ?? "").slice(0, 200);

/** Only ever back into the admin — never to an address someone put in a link. */
const safeNext = (next: string) =>
  next.startsWith("/admin") && !next.includes("//") && !next.includes("\\") ? next : "/admin";

export async function login(_prev: FormResult, fd: FormData): Promise<FormResult> {
  if (!databaseConfigured()) return { error: NO_DB };
  const email = field(fd, "email", 200).toLowerCase();
  const pw = password(fd, "password");

  const ip = clientIp(await headers());
  if (limited(`login:ip:${ip}`, 12, 15 * 60_000) || limited(`login:email:${email}`, 8, 15 * 60_000)) {
    return { error: "Too many attempts. Wait fifteen minutes and try again." };
  }

  const user = await findStaffByEmail(email);
  // Hash even when there is no such account, so the response time does not
  // tell anyone which addresses belong to staff.
  const valid = user ? await verifyPassword(pw, user.passwordHash) : await verifyPassword(pw, await dummyHash()).then(() => false);
  if (!user || !valid || !user.active) {
    return { error: "That email and password do not match an active account." };
  }

  await createSession(user.id);
  redirect(safeNext(field(fd, "next", 200)));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

/**
 * The first account. Only possible while there are no staff at all, and in
 * production only with ADMIN_SETUP_TOKEN — otherwise the first stranger to
 * find /admin/setup on a freshly deployed site would own it.
 */
export async function setupOwner(_prev: FormResult, fd: FormData): Promise<FormResult> {
  if (!databaseConfigured()) return { error: NO_DB };
  if (limited(`setup:${clientIp(await headers())}`, 10, 15 * 60_000)) {
    return { error: "Too many attempts. Wait fifteen minutes and try again." };
  }
  if ((await staffCount()) > 0) redirect("/admin/login");

  if (process.env.NODE_ENV === "production") {
    const expected = process.env.ADMIN_SETUP_TOKEN;
    if (!expected) return { error: "Set ADMIN_SETUP_TOKEN in the environment first, then enter it here." };
    if (!safeEqual(field(fd, "setupToken", 200), expected)) return { error: "That setup token is not right." };
  }

  const name = field(fd, "name", 120);
  const email = field(fd, "email", 200);
  const pw = password(fd, "password");
  if (name.length < 2) return { error: "Please give your name." };
  if (!EMAIL.test(email)) return { error: "Please give a valid email address." };
  const problem = passwordProblem(pw);
  if (problem) return { error: problem };
  if (pw !== password(fd, "confirm")) return { error: "The two passwords do not match." };

  const created = await createStaff({ name, email, password: pw, role: "owner" });
  await createSession(created.id);
  redirect("/admin");
}

export async function changeOwnPassword(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const account = await findStaff(me.id);
  if (!account) redirect("/admin/login");

  if (!(await verifyPassword(password(fd, "current"), account.passwordHash))) {
    return { error: "Your current password is not right." };
  }
  const next = password(fd, "password");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== password(fd, "confirm")) return { error: "The two new passwords do not match." };

  await setPassword(me.id, next);
  // Sign out everywhere else — a password change is usually a reason to.
  await destroyAllSessions(me.id);
  await createSession(me.id);
  return { notice: "Password changed. Any other devices you were signed in on have been signed out." };
}
