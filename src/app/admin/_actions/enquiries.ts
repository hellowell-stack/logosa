"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { journeyBySlug } from "@/data/journeys";
import { requireStaff } from "@/lib/auth/session";
import { convertEnquiry, setEnquiryStatus } from "@/lib/bookings/service";
import { isEnquiryStatus } from "@/lib/bookings/status";
import { field } from "@/lib/validate";
import { isUuid, type FormResult } from "@/lib/form-result";

export async function setEnquiryStatusAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = field(fd, "id", 40);
  const status = field(fd, "status", 20);
  if (!isUuid(id) || !isEnquiryStatus(status) || status === "converted") return { error: "Unknown enquiry or status." };

  const r = await setEnquiryStatus(id, status, { staffId: me.id, staffName: me.name });
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin", "layout");
  return { notice: status === "new" ? "Reopened." : status === "replied" ? "Marked as replied." : "Closed." };
}

export async function convertEnquiryAction(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireStaff();
  const id = field(fd, "id", 40);
  if (!isUuid(id)) return { error: "Unknown enquiry." };

  const slug = field(fd, "journey", 80);
  const journey = slug && slug !== "custom" ? journeyBySlug(slug) : undefined;
  if (slug && slug !== "custom" && !journey) return { error: "Choose a journey from the list, or a custom trip." };

  const r = await convertEnquiry(
    id,
    { slug: journey?.slug ?? null, name: journey?.name ?? "Custom trip" },
    { staffId: me.id, staffName: me.name },
  );
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin", "layout");
  redirect(`/admin/bookings/${r.value}`);
}
