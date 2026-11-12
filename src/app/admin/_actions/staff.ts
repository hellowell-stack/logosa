"use server";

import { revalidatePath } from "next/cache";
import { destroyAllSessions, requireOwner } from "@/lib/auth/session";
import { passwordProblem } from "@/lib/auth/password";
import { createStaff, findStaff, findStaffByEmail, otherActiveOwners, setPassword, updateStaff } from "@/lib/auth/staff";
import { EMAIL, field } from "@/lib/validate";
import { isUuid, type FormResult } from "@/lib/form-result";

/**
 * Staff management — the owner's alone. The guard that matters most is the
 * last one in each action: nobody can remove the last active owner, because
 * then no one could ever manage staff again without editing the database.
 */

const done = (notice: string): FormResult => {
  revalidatePath("/admin/staff");
  return { notice };
};

export async function addStaffAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const name = field(fd, "name", 120);
  const email = field(fd, "email", 200);
  const role = field(fd, "role", 10) === "owner" ? "owner" : "staff";
  const password = String(fd.get("password") ?? "").slice(0, 200);

  if (name.length < 2) return { error: "Give their name." };
  if (!EMAIL.test(email)) return { error: "Give a valid email address." };
  if (await findStaffByEmail(email)) return { error: "There is already an account with that email." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  await createStaff({ name, email, password, role });
  return done(`${name} can now sign in. Give them the password you set, and ask them to change it under Account.`);
}

export async function setStaffActiveAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireOwner();
  const id = field(fd, "id", 40);
  if (!isUuid(id)) return { error: "Unknown account." };
  if (id === me.id) return { error: "You cannot deactivate your own account." };
  const target = await findStaff(id);
  if (!target) return { error: "Unknown account." };

  const active = field(fd, "active", 5) === "true";
  if (!active && target.role === "owner" && (await otherActiveOwners(id)) === 0) {
    return { error: "That is the last active owner." };
  }
  await updateStaff(id, { active });
  if (!active) await destroyAllSessions(id);
  return done(active ? `${target.name} can sign in again.` : `${target.name} is signed out and can no longer sign in.`);
}

export async function setStaffRoleAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireOwner();
  const id = field(fd, "id", 40);
  if (!isUuid(id)) return { error: "Unknown account." };
  const role = field(fd, "role", 10) === "owner" ? "owner" : "staff";
  if (role === "staff" && (await otherActiveOwners(id)) === 0) {
    return { error: "That would leave no active owner." };
  }
  const target = await findStaff(id);
  if (!target) return { error: "Unknown account." };
  await updateStaff(id, { role });
  return done(
    role === "owner"
      ? `${target.name} is now an owner and can manage staff.`
      : `${target.name} is now staff${id === me.id ? " — you no longer have access to this page" : ""}.`,
  );
}

export async function resetStaffPasswordAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const id = field(fd, "id", 40);
  if (!isUuid(id)) return { error: "Unknown account." };
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const target = await findStaff(id);
  if (!target) return { error: "Unknown account." };

  await setPassword(id, password);
  await destroyAllSessions(id);
  return done(`Password reset for ${target.name}, and they have been signed out everywhere.`);
}
