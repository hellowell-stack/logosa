import type { MetadataRoute } from "next";
import { SITE_URL } from "@/data/company";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes carry no indexable content and the enquiry endpoint
        // should never be crawled. The admin and travellers' private booking
        // pages also send X-Robots-Tag: noindex (see src/proxy.ts); this keeps
        // polite crawlers from requesting them at all.
        disallow: ["/api/", "/admin", "/booking/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
