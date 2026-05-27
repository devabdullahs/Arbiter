import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This dashboard has its own lockfile and is self-contained. Pin the
  // workspace root to web/ so Next doesn't infer the bot's repo root (which
  // also has a lockfile) and so output file tracing stays scoped here.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
