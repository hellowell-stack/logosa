import { NextResponse, type NextRequest } from "next/server";

/**
 * Two cheap checks at the edge of the request, and nothing that touches the
 * database — this runs on every matching request, prefetches included.
 *
 *   /admin/*     no session cookie → straight to the sign-in page. This is
 *                an optimistic check only: the real one is `requireStaff()`,
 *                which every admin page and action calls itself.
 *   /booking/*   a traveller's private link. Kept out of search engines, and
 *                the token in the URL is not handed to any site linked from it.
 */

const OPEN = new Set(["/admin/login", "/admin/setup"]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!OPEN.has(pathname) && !req.cookies.has("lg_admin")) {
      const url = new URL("/admin/login", req.url);
      if (pathname !== "/admin") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/booking/:path*"],
};
