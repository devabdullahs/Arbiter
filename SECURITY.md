# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via one of:

- **GitHub:** open a [private security advisory](https://github.com/devabdullahs/Arbiter/security/advisories/new)
- **Discord:** DM the maintainer **[@monster20](https://discord.com/users/170115708871507970)**

Include a description, reproduction steps, and the potential impact. You'll get an acknowledgement as
soon as possible, and a fix or mitigation will be coordinated before any public disclosure.

## Handling secrets

This bot relies on a Discord bot token and a database URL stored in `.env` (which is git-ignored).

- Never commit `.env` or paste tokens into issues, pull requests, or logs.
- If a token is ever exposed, **regenerate it immediately** in the Discord Developer Portal and rotate
  the database credentials.

## Self-hosting model

Arbiter is designed so an organizer can run it under their own Discord application, infrastructure,
and database. A normal self-hosted deployment keeps operational data in the organizer's PostgreSQL
database instead of a third-party hosted service.

For setup and permission guidance, see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Data and evidence

Arbiter stores tournament operations data such as matches, teams, referee logs, warnings, pause logs,
evidence metadata, and Discord channel/message references. Evidence uploads may be mirrored into a
configured Discord evidence-vault channel. Treat evidence as sensitive event data and configure access
to evidence channels accordingly.

Do not upload passwords, secret keys, private government IDs, or unrelated personal data as evidence.

## Permission boundaries

Guild-installed commands can manage tournament operations only after Arbiter resolves the
organization, the invoking user, and the relevant permissions. User-installed commands are deliberately
limited: they can support personal/referee companion workflows, but they do not create channels,
manage roles, close matches, or mutate org state without a valid authorized org context.

Recommended Discord permission practice:

- Grant Manage Channels only if match or BR room automation is used.
- Grant Manage Roles only if Arbiter should create or sync roles.
- Keep Arbiter's role above roles it needs to manage.
- Use `/org setup` and `/org member` to define trusted admins/referees explicitly.

## Operational hardening

- Rotate test tokens before public demos or releases.
- Use separate Discord applications for development and production.
- Back up production Postgres before major migrations.
- Run `npm run check` and `npx prisma validate` before deploying.
- Restrict match-log and evidence-vault channels to the people who should see operational records.
- Review bot permissions after every event and remove permissions no longer needed.

## Supported versions

This project is actively developed; security fixes are applied to the `main` branch.
