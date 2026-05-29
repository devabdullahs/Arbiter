import { NextResponse, type NextRequest } from "next/server";

function canonicalHost() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://arbiter.moonbot.info";

  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "arbiter.moonbot.info";
  }
}

// Strict, nonce-based Content-Security-Policy. script-src uses a per-request
// nonce + 'strict-dynamic' (host allowlists are ignored for scripts, so the
// nonce is the trust anchor) — this is the main XSS defense. style-src keeps
// 'unsafe-inline' because the UI relies on inline style attributes (React
// style={{}}, Radix, sonner); styles are not a meaningful injection vector.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  const connectSrc = ["'self'"];
  const imgSrc = ["'self'", "data:", "blob:", "https://cdn.discordapp.com"];
  if (gaEnabled) {
    connectSrc.push(
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    );
    imgSrc.push("https://www.google-analytics.com");
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  const canonical = canonicalHost();

  if (host === `www.${canonical}`) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = canonical;
    return NextResponse.redirect(url, 308);
  }

  // Fresh nonce per request; Next.js reads it from the CSP header and applies
  // it to its framework/page scripts automatically during SSR.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Skip API routes, build assets, static files, and prefetches — they
      // don't render documents that need the nonce.
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon.png|og-image.png|uploads).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
