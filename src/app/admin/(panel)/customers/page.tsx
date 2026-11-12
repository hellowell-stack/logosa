import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle, Table, td, th, when } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/session";
import { customers } from "@/lib/bookings/service";
import { clean } from "@/lib/validate";

export const metadata: Metadata = { title: "Customers" };

/**
 * Everyone who has booked, one row per email address, built from the bookings
 * themselves — so there is no customer record to fall out of step with them.
 */
export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireStaff();
  const sp = await props.searchParams;
  const q = clean(sp.q, 100);
  const rows = await customers(q || undefined);

  return (
    <>
      <PageTitle title="Customers">
        <form className="flex items-center gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search customers" className="field w-56 !py-2" />
          <button type="submit" className="btn btn-ghost !px-4 !py-2.5">
            Search
          </button>
        </form>
      </PageTitle>

      {rows.length === 0 ? (
        <Empty>{q ? "Nobody matches that search." : "No customers yet — they appear here with their first booking."}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Contact</th>
              <th className={th}>Country</th>
              <th className={`${th} text-right`}>Bookings</th>
              <th className={`${th} text-right`}>Travelled or confirmed</th>
              <th className={th}>Latest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.email} className="hover:bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)]">
                <td className={td}>
                  <Link href={`/admin/bookings?status=all&q=${encodeURIComponent(c.email)}`} className="link-rule text-ink">
                    {c.name}
                  </Link>
                </td>
                <td className={td}>
                  <a href={`mailto:${c.email}`} className="block text-ink hover:underline">
                    {c.email}
                  </a>
                  {c.phone && <span className="block text-micro text-ink-faint">{c.phone}</span>}
                </td>
                <td className={td}>{c.country ?? "—"}</td>
                <td className={`${td} tabular-nums text-right`}>{c.total}</td>
                <td className={`${td} tabular-nums text-right`}>{c.confirmed}</td>
                <td className={`${td} whitespace-nowrap`}>{when(c.last)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
