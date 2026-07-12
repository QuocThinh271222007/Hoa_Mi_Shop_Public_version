import type { MetadataRoute } from "next";

// Keep the admin panel and internal API out of search engines. Public shop pages
// stay crawlable. This is defense-in-depth alongside the X-Robots-Tag header and
// the per-page `robots: { index: false }` metadata on the admin layout.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
  };
}
