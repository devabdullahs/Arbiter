import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName} - Discord esports referee bot`,
    short_name: siteName,
    description: siteDescription,
    start_url: "/login",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#00bcd4",
    icons: [
      {
        src: "/arbiter-icon.png",
        sizes: "1254x1254",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
