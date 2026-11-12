import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import type { StaffRole } from "@/lib/db/schema";
import { hashPassword } from "./password";

/** Staff accounts: the only people who can sign in. */

export async function staffCount(): Promise<number> {
  const d = await getDb();
  return d.staff.countDocuments();
}

export async function findStaffByEmail(email: string) {
  const d = await getDb();
  const s = await d.staff.findOne({ email: email.toLowerCase() });
  return s ? { ...s, id: s._id } : null;
}

export async function findStaff(id: string) {
  const d = await getDb();
  const s = await d.staff.findOne({ _id: id });
  return s ? { ...s, id: s._id } : null;
}

export async function listStaff() {
  const d = await getDb();
  const rows = await d.staff
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ name: 1 })
    .toArray();
  return rows.map(({ _id, name, email, role, active, createdAt, lastLoginAt }) => ({
    id: _id,
    name,
    email,
    role,
    active,
    createdAt,
    lastLoginAt,
  }));
}

export async function createStaff(input: { name: string; email: string; password: string; role: StaffRole }) {
  const d = await getDb();
  const id = randomUUID();
  await d.staff.insertOne({
    _id: id,
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    active: true,
    createdAt: new Date(),
    lastLoginAt: null,
  });
  return { id };
}

export async function setPassword(id: string, password: string) {
  const d = await getDb();
  await d.staff.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password) } });
}

export async function updateStaff(id: string, fields: { active?: boolean; role?: StaffRole }) {
  const d = await getDb();
  await d.staff.updateOne({ _id: id }, { $set: fields });
}

/** Active owners other than `exceptId` — so the last one cannot lock everyone out. */
export async function otherActiveOwners(exceptId: string): Promise<number> {
  const d = await getDb();
  return d.staff.countDocuments({ role: "owner", active: true, _id: { $ne: exceptId } });
}

/** Constant-time string comparison, for the setup token. */
export function safeEqual(a: string, b: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}
