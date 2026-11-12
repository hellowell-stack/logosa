import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryBadge, Empty, PageTitle, Table, Tabs, td, th, when } from "@/components/admin/ui";
import { enquirySubject } from "@/lib/bookings/enquiry-subject";
import { requireStaff } from "@/lib/auth/session";
import { listEnquiries } from "@/lib/bookings/service";
import { ENQUIRY_STATUS_LABEL, isEnquiryStatus } from "@/lib/bookings/status";
import type { EnquiryStatus } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Enquiries" };

const TABS: { key: EnquiryStatus | "all"; label: string }[] = [
  { key: "new", label: ENQUIRY_STATUS_LABEL.new },
  { key: "replied", label: ENQUIRY_STATUS_LABEL.replied },
  { key: "converted", label: ENQUIRY_STATUS_LABEL.converted },
  { key: "closed", label: ENQUIRY_STATUS_LABEL.closed },
  { key: "all", label: "All" },
];

export default async function EnquiriesPage(props: PageProps<"/admin/enquiries">) {
  await requireStaff();
  const sp = await props.searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "new";
  const status = raw === "all" || isEnquiryStatus(raw) ? raw : "new";
  const rows = await listEnquiries(status);

  return (
    <>
      <PageTitle title="Enquiries" />
      <p className="-mt-3 mb-6 max-w-2xl text-small leading-relaxed text-ink-soft">
        Everything sent through the contact form and trip planner. Reply by email, then mark it
        replied — or, once someone is ready to book, turn it into a booking so the quote and
        payments are tracked.
      </p>

      <Tabs current={status} items={TABS.map((t) => ({ ...t, href: `/admin/enquiries?status=${t.key}` }))} />

      {rows.length === 0 ? (
        <Empty>{status === "new" ? "No new enquiries. Nothing waiting for a reply." : "Nothing in this list."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Reference</th>
              <th className={th}>From</th>
              <th className={th}>About</th>
              <th className={th}>When</th>
              <th className={`${th} text-right`}>Pax</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]">
                <td className={td}>
                  <Link href={`/admin/enquiries/${e.id}`} className="ref link-rule text-ink">
                    {e.reference}
                  </Link>
                  <span className="mt-1 block text-micro text-ink-faint">{when(e.createdAt)}</span>
                </td>
                <td className={td}>
                  <span className="block text-ink">{e.name}</span>
                  <span className="block text-micro text-ink-faint">{e.email}</span>
                </td>
                <td className={td}>{enquirySubject(e)}</td>
                <td className={td}>{[e.preferredStart, e.duration].filter(Boolean).join(" · ") || "—"}</td>
                <td className={`${td} tabular-nums text-right`}>{e.travellers ?? "—"}</td>
                <td className={td}>
                  <EnquiryBadge status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
