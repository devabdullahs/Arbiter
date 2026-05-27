import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP, lastLoginMethod, magicLink } from "better-auth/plugins";

import { sendAuthEmail } from "./email";
import { prisma } from "./prisma";

// Relying-party identity for WebAuthn passkeys, derived from the app URL.
// rpID is the hostname (no scheme/port); origin is the full origin.
const authUrl = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Passwordless only: no email/password. Email login is magic link + OTP.
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Linking Discord to an existing (e.g. email-first) account is what
      // unlocks org access — Arbiter's OrgMember model is keyed to Discord IDs.
      trustedProviders: ["discord"],
    },
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
