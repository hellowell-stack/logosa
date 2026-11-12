import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfigured, getDb } from "@/lib/db";
import type { StaffRole } from "@/lib/db/schema";
import { sha256, token } from "@/lib/ids";

/**
 * STAFF SESSIONS — database-backed.
 *
 * The cookie holds a random 256-bit token; the database holds its SHA-256.
 * Every request checks the session and the account behind it, so signing a
 * person out, deactivating them or resetting their password takes effect on
 * their very next click rather than whenever a signed cookie happens to expire.
 * Expired sessions are removed by a TTL index.
 *
 * The cookie is scoped to /admin, so it is never sent with a request to the
 * public site at all.
 */

export const SESSION_COOKIE = "lg_admin";
const PATH = "/admin";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export async function createSession(staffId: string): Promise<void> {
  const d = await getDb();
  const t = token();
  const expiresAt = new Date(Date.now() + TTL_MS);

  await d.sessions.insertOne({ _id: sha256(t), staffId, createdAt: new Date(), expiresAt });
  await d.staff.updateOne({ _id: staffId }, { $set: { lastLoginAt: new Date() } });

  (await cookies()).set(SESSION_COOKIE, t, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PATH,
    expires: expiresAt,
  });
}

/** The signed-in staff member, or null. Memoised for the length of one render. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t || !databaseConfigured()) return null;

  const d = await getDb();
  // The TTL monitor runs about once a minute, so check expiry here too.
  const session = await d.sessions.findOne({ _id: sha256(t), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const s = await d.staff.findOne(
    { _id: session.staffId, active: true },
    { projection: { name: 1, email: 1, role: 1 } },
  );
  return s ? { id: s._id, name: s.name, email: s.email, role: s.role } : null;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t && databaseConfigured()) {
    const d = await getDb();
    await d.sessions.deleteOne({ _id: sha256(t) });
  }
  // `delete(name)` would miss a cookie scoped to /admin; expire it at its own path.
  jar.set(SESSION_COOKIE, "", { path: PATH, maxAge: 0, httpOnly: true });
}

/** Sign out every device a staff member is signed in on. */
export async function destroyAllSessions(staffId: string): Promise<void> {
  const d = await getDb();
  await d.sessions.deleteMany({ staffId });
}

/**
 * The gate. Every admin page and every admin server action calls this first —
 * the proxy only makes an optimistic check on the cookie's presence, and a
 * layout is not a security boundary.
 */
export async function requireStaff(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** Staff management is the owner's alone. */
export async function requireOwner(): Promise<SessionUser> {
  const s = await requireStaff();
  if (s.role !== "owner") redirect("/admin");
  return s;
}
