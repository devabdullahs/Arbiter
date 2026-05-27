# Arbiter Web Dashboard

Next.js dashboard for Arbiter operators. It uses Better Auth for passwordless
sign-in, Discord account linking, passkeys, app-level admin controls, and
organization email invites backed by the shared Prisma/Postgres database.

## Local Setup

```bash
cd web
npm install
copy .env.example .env.local
npm run db:generate
npm run dev
```

Open http://localhost:3000.

## Required Environment

- `DATABASE_URL` points to the same Postgres database used by the bot.
- `BETTER_AUTH_SECRET` should be a strong random secret.
- `BETTER_AUTH_URL` is the dashboard base URL.
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` come from the same Discord
  application as the bot.
- `RESEND_API_KEY` and `EMAIL_FROM` are optional in development. Without
  `RESEND_API_KEY`, auth and invite emails print to the server console.

## Auth Model

- Dashboard users sign in with Discord, magic links, email OTP, or passkeys.
- The Security page lets users name, review, rename, and delete passkeys.
- Discord linking maps Better Auth users to Arbiter `UserProfile` records.
- Arbiter org permissions continue to come from `OrgMember`.
- Better Auth Admin is app-level dashboard administration only.
- Better Auth Organization is intentionally not used because Arbiter already has
  Discord-native `Organization`, `Team`, and `TeamMember` models.

## Useful Commands

```bash
npm run lint
npm run build
npm run db:generate
```
