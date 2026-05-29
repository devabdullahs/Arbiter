import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework/version via the X-Powered-By header.
  poweredByHeader: false,
  // This dashboard has its own lockfile and is self-contained. Pin the
  // workspace root to web/ so Next doesn't infer the bot's repo root (which
  // also has a lockfile) and so output file tracing stays scoped here.
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Clickjacking fallback for browsers that ignore CSP frame-ancestors
          // (the full CSP, incl. frame-ancestors 'none', is set in proxy.ts).
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
