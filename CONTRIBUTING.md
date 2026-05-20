# Contributing

Thanks for your interest in improving the Esports Admin Bot! Bug reports, feature ideas, docs, and
code contributions are all welcome.

> **License note:** This project is licensed under the **Apache License 2.0**. By contributing, you
> agree that your contributions are provided under the same license (Apache-2.0), per its Section 5.
> See [LICENSE](LICENSE).

## Getting started

See the [README](README.md#setup) for full setup. In short:

```bash
npm install
docker compose up -d          # local Postgres
cp .env.example .env          # fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL
npm run db:generate
npm run db:migrate
npm run deploy:commands       # register slash commands (set DISCORD_DEV_GUILD_ID for fast dev)
npm run dev
```

## Before opening a pull request

- Run the checks and make sure they pass (CI runs the same on every PR):
  ```bash
  npm run check
  ```
- If you change the database schema (`prisma/schema.prisma`), include a migration:
  ```bash
  npm run db:migrate -- --name your_change
  ```
- Update the README/docs if you add or change commands or behavior.
- Add or update tests under `test/` where it makes sense.
- Keep PRs small and focused, with a clear description.

## Project layout & conventions

- Node.js **ESM** (`"type": "module"`), Node **22+**.
- `src/commands/` — slash commands and install-context policy
- `src/services/` — business logic (org, match, referee, presets, profiles, standalone logs)
- `src/ui/` — Components V2 panels and modals
- `src/interactions/router.js` — button, select, modal, and autocomplete routing
- `src/utils/` — custom IDs and view mapping
- Keep secrets out of code — everything sensitive comes from `.env`.

## Reporting bugs & requesting features

Use the issue templates (Bug report / Feature request). For **security issues**, do **not** open a
public issue — follow [SECURITY.md](SECURITY.md).

## Questions

Reach the maintainer **Abdullah** — Discord [@monster20](https://discord.com/users/170115708871507970)
or GitHub [@devabdullahs](https://github.com/devabdullahs).
