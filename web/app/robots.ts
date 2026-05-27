import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/privacy",
          "/terms",
          "/login",
          "/favicon.ico",
          "/icon.png",
          "/og-image.png",
        ],
        disallow: [
          "/api/",
          "/audit",
          "/br",
          "/dashboard",
          "/evidence",
          "/invite",
          "/matches",
          "/org",
          "/player",
          "/profiles",
          "/referees",
          "/security",
          "/settings",
          "/workers",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
