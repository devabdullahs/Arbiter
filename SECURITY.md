# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via one of:

- **GitHub:** open a [private security advisory](https://github.com/devabdullahs/esports-admin-bot/security/advisories/new)
- **Discord:** DM the maintainer **[@monster20](https://discord.com/users/170115708871507970)**

Include a description, reproduction steps, and the potential impact. You'll get an acknowledgement as
soon as possible, and a fix or mitigation will be coordinated before any public disclosure.

## Handling secrets

This bot relies on a Discord bot token and a database URL stored in `.env` (which is git-ignored).

- Never commit `.env` or paste tokens into issues, pull requests, or logs.
- If a token is ever exposed, **regenerate it immediately** in the Discord Developer Portal and rotate
  the database credentials.

## Supported versions

This project is actively developed; security fixes are applied to the `main` branch.
