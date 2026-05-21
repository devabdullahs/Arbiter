# Arbiter

**A Discord referee & match-operations bot for esports.**

A multi-tenant Discord esports operations bot for referees and tournament admins, built with
[`discord.js`](https://discord.js.org/) (Components V2 + modals), PostgreSQL, and Prisma.

It runs match control panels, map vetoes, score reporting, warnings, pauses, evidence handling,
referee assignment, dispute escalation, and per-server rules presets — and it works both inside a
configured org server **and** as a user-installed companion app for referees working external events.

> **License:** [Apache-2.0](LICENSE) — free to use, modify, and distribute, **including commercially**.
> You must preserve the copyright and attribution notices (see [`NOTICE`](NOTICE)). If you or your org
> runs this in production, please consider [sponsoring](#support--sponsoring) 💜
> (see [License](#license)).

---

## Features

**Match operations**
- Match control panel (Components V2) with referee actions: Start Veto, Start Match, Report Score,
  Pause, Warn, Evidence, Ruling, Dispute, Claim, Call Ref, and Close.
- Temporary per-match text + voice rooms, auto-created under a configured category and cleaned up on close.
- Optional **team-role room access**: pass a Discord role per team and the match room grants those members access.
- **Channel transcript archiving** — when a match closes, the room's text and voice-chat history is saved
  to the match-log channel as a `.txt` transcript before the channels are deleted.

**Map veto & rules presets**
- Veto formats: single final-map ban, series map picks, and manual picks.
- Built-in presets: **Generic**, **Overwatch** (mode-rotation pick flow), and **Valorant** (current
  competitive map pool + ban/pick veto with side-selection reminders).
- **Custom per-server presets** via `/preset` — define your own map pool + veto format, saved per guild
  and selectable in match creation through autocomplete.

**Scoring**
- Referee score reporting with required screenshot proof, logged as a rich match-log embed (with the
  screenshot attached) and mirrored to the evidence vault.
- Optional **player score reporting** — enable per match so teams can report results from the match channel.
- Re-opening the score form pre-fills the current score so you edit instead of re-entering.

**Referee tooling**
- Referee shifts and on-shift paging; **Call Ref** routes only to the assigned referee once a match is claimed.
- Referee assignment / claim (`/ref`, panel Claim button).
- Dispute escalation that flips a match to the `DISPUTED` status and alerts referees.
- Roster submission, review, approval, and locking (`/roster`).
- Searchable per-server rulebook (`/rule`).

**Evidence & logging**
- **Evidence vault**: uploaded files are re-hosted into the vault channel so links don't expire, with
  embeds that show the image inline and tag related players.
- User pickers in modals support selecting **multiple players** (up to 25) plus a free-text fallback.
- Pause logs include duration and a live Discord "resumes at" timestamp.
- **Standalone `/log`** (user-installed): referees working external tournaments — where the bot isn't in
  the server and no match exists — can log notes, scores, evidence, and warnings with no `match_id`.
  Each entry is saved to the referee's profile, DM'd back as a receipt, and retrievable via `/log list`.

---

## Install modes

The bot uses Discord application-command install contexts:

- **Guild install** — org/admin/referee workflows inside an esports server.
- **User install** — player- and referee-companion workflows anywhere Discord allows user-installed apps
  (DMs, other servers), including the standalone `/log` tool.

Because Discord contexts are command-level, admin subcommands are also rejected at runtime unless the
interaction is in the configured guild and the user is an authorized org admin/referee.

---

## Requirements

- Node.js **22.12** or newer (`.nvmrc` included)
- Docker (for local PostgreSQL via `docker-compose.yml`), or any PostgreSQL instance
- A Discord application + bot token

## Setup

```bash
npm install
docker compose up -d            # start local Postgres
cp .env.example .env            # (Windows: copy .env.example .env)
npm run db:generate
npm run db:migrate
```

Fill in `.env`:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DATABASE_URL=postgresql://esports:esports@localhost:5432/esports_admin_bot?schema=public
DISCORD_DEV_GUILD_ID=optional-guild-id-for-fast-command-registration
```

Register slash commands, then start the bot:

```bash
npm run deploy:commands
npm run dev          # watch mode (or: npm start)
```

---

## Command reference

**Org / admin (guild only)**
- `/org setup` — configure admin role, referee role, match category, match-log channel, and evidence
  channel. `auto_create:true` creates missing roles/channels.
- `/match-admin create` — create a match panel. Supports `best_of` 1–99, `veto_format`, `rules_preset`
  (built-in or custom, with autocomplete), optional `team_a_role`/`team_b_role` room access, and
  `player_scores` to let teams report scores.
- `/match-admin panel | list | ruling` — re-post a panel, list recent matches, or apply a
  forfeit/DQ/no-show/admin-loss/cancellation ruling.
- `/score report` — modal for final score + required screenshot proof.
- `/warn issue` — warn a player, attach evidence, DM a receipt, optionally DM the player.
- `/ref-log add` — referee notes, dispute rulings, roster/technical/pause notes, with attachments.
- `/ref dashboard | assign | unassign` — referee work queue and assignment.
- `/roster submit | view | approve | reject` — match roster workflow.
- `/rule search | add | delete` — per-server rulebook.
- `/preset create | list | delete` — custom per-server rules presets.
- `/ref-shift` — mark a referee available for targeted pages.

**Player / referee companion (user-installable)**
- `/match lookup` — player-safe match panel.
- `/profile link | view` — link and view game accounts.
- `/checkin` — record a check-in for a public match code.
- `/evidence submit | review` — attach/review evidence for a match.
- `/call-ref` — page the referee for a match.
- `/ref-my dashboard | log | score` — referee tools for matches you're assigned to, off-server.
- `/log note | score | evidence | warning | list` — standalone, matchless logging for external events.

---

## Architecture

```text
src/
  commands/        Slash commands and install-context policy
  db/              Prisma client
  interactions/    Button, select menu, modal, and autocomplete routing
  services/        Org, match, referee, preset, profile, standalone-log logic
  ui/              Components V2 panels and modals
  utils/           Custom IDs and view mapping
prisma/
  schema.prisma    Multi-tenant schema
  migrations/      SQL migration history
test/              Node test runner specs
```

Model boundaries:

- `Organization` maps one Discord guild to an org tenant; `OrgSettings` holds its roles/channels.
- `UserProfile` is global and reusable across orgs.
- `Match.publicCode` is the user-facing match ID used by commands and buttons.
- `RulesPreset` stores custom per-org presets; `StandaloneLog` stores matchless referee logs per user.
- Operational records carry `organizationId` so a hosted deployment can serve many orgs safely.

---

## Verification

```bash
npm run check     # syntax check + Node test suite
```

Tests cover veto/match-view helpers, install-context policy, admin interaction gates, modal/file-upload
support, and command registration. Full integration testing requires a running Postgres, applied
migrations, registered commands, and a live Discord app.

---

## Support & Sponsoring

This bot is free and open source under Apache-2.0 — **including for commercial use**, so events,
leagues, and organizations are welcome to run it. If it's useful to you (especially in production),
please consider **[sponsoring the project on GitHub](https://github.com/sponsors/devabdullahs)** 💜.
Sponsorship is what keeps it actively maintained and is hugely appreciated.

- **Author:** Abdullah
- **GitHub:** [@devabdullahs](https://github.com/devabdullahs)
- **Discord:** [@monster20](https://discord.com/users/170115708871507970)
- **Project repo:** https://github.com/devabdullahs/Arbiter

## License

Licensed under the **[Apache License 2.0](LICENSE)** — an OSI-approved open-source license.

**In plain terms:** anyone may use, modify, and distribute this software, **including commercially**,
free of charge. In return, you must:

- include a copy of the license,
- preserve the copyright, license, and attribution notices (see [`NOTICE`](NOTICE)), and
- state in modified files that you changed them.

It also includes an explicit patent grant and the standard "no warranty" disclaimer. Attribution to the
original author must be kept. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) for the full details.
