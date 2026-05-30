import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP, lastLoginMethod, magicLink } from "better-auth/plugins";

import { sendAuthEmail } from "./email";
import { prisma } from "./prisma";
import { siteUrl } from "./site";

// Relying-party identity for WebAuthn passkeys, derived from the app URL.
// rpID is the hostname (no scheme/port); origin is the full origin.
//
// If BETTER_AUTH_URL is unset we must NOT fall back to localhost in production:
// a passkey's rpID has to match the page's domain, so an rpID of "localhost"
// makes iOS Safari (and any browser on the real domain) reject the ceremony.
// Fall back to the canonical public site URL in production instead, and only
// use localhost for local development.
const fallbackAuthUrl =
  process.env.NODE_ENV === "production" ? siteUrl : "http://localhost:3000";
const authUrl = new URL(process.env.BETTER_AUTH_URL ?? fallbackAuthUrl);

// Restrict which origins Better Auth honors for callbacks/CORS so a spoofed
// Host header can't redirect to or leak auth state at another origin.
const trustedOrigins = Array.from(
  new Set([authUrl.origin, siteUrl].filter(Boolean)),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the session at most once per day
    freshAge: 60 * 60, // require a sign-in within the last hour for sensitive ops
  },
  advanced: {
    // Behind Cloudflare + Docker, derive the real client IP from
    // cf-connecting-ip (falling back to x-forwarded-for) so rate limiting and
    // IP tracking key on the actual user, not the proxy/gateway address.
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
  // Throttle auth endpoints to curb brute-force and email-bombing. Global
  // default is 100 req/min/IP; the email-sending and code-verifying routes get
  // stricter limits. In-memory storage is fine for the single-instance Docker
  // deploy — switch `storage` to "database"/"secondary-storage" if you scale
  // to multiple instances.
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/magic-link": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  // Passwordless only: no email/password. Email login is magic link + OTP.
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      scope: ["identify", "email", "guilds"],
    },
  },
  account: {
    // Encrypt stored OAuth tokens at rest (AES-256-GCM). Arbiter reads the
    // Discord access token server-side to list a user's guilds, so it shouldn't
    // sit in the DB as plaintext. NOTE: already-linked accounts must reconnect
    // Discord once — old plaintext tokens won't decrypt, and the org page's
    // "reconnect" path surfaces that gracefully.
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // Linking Discord to an existing (e.g. email-first) account is what
      // unlocks org access — Arbiter's OrgMember model is keyed to Discord IDs.
      trustedProviders: ["discord"],
    },
  },
  hooks: {
    // Lightweight auth audit trail to stdout (captured by container logs):
    // every successful sign-in (any method) and every sign-out.
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (newSession) {
        console.log(
          JSON.stringify({
            evt: "auth.sign_in",
            path: ctx.path,
            userId: newSession.user?.id ?? null,
            ip: newSession.session?.ipAddress ?? null,
            at: new Date().toISOString(),
          }),
        );
      } else if (ctx.path === "/sign-out") {
        console.log(
          JSON.stringify({ evt: "auth.sign_out", at: new Date().toISOString() }),
        );
      }
    }),
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendAuthEmail({
          to: email,
          subject: "Your Arbiter sign-in link",
          kind: "magic-link",
          url,
        });
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp }) => {
        await sendAuthEmail({
          to: email,
          subject: "Your Arbiter sign-in code",
          kind: "otp",
          otp,
        });
      },
    }),
    // WebAuthn passkeys (Face ID / Touch ID / security keys).
    passkey({
      rpID: authUrl.hostname,
      rpName: "Arbiter",
      origin: authUrl.origin,
    }),
    // App-level admin capabilities (manage/ban dashboard users). Distinct from
    // org admin/referee roles, which come from the bot's OrgMember model.
    admin(),
    // Tracks the last-used login method (cookie) for the "Last used" badge.
    lastLoginMethod(),
    // nextCookies must be the last plugin.
    nextCookies(),
  ],
});
