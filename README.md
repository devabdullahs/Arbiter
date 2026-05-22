<p align="center">
  <img src="docs/images/arbiter-banner.png" alt="Arbiter - Discord Esports Referee Bot">
</p>

# Arbiter

**A Discord referee and tournament-operations bot for esports.**

Arbiter is a multi-tenant Discord app for running competitive matches, referee logs, score proof,
evidence vaulting, roster workflows, battle-royale lobbies, and player/referee companion commands.
It is built with [discord.js](https://discord.js.org/) using Components V2, modals, PostgreSQL, and
Prisma.

It is designed for two real tournament situations:

- **Guild-installed org mode:** the bot is installed in an esports server and can create rooms,
  manage match panels, route referee work, and write to configured log channels.
- **User-installed companion mode:** players and referees can use safe commands in DMs, private
  channels, or other servers where the bot is not installed. Admin mutations are blocked unless the
  user is authorized for the org and the command has enough context.

> License: [Apache-2.0](LICENSE). You may use, modify, and distribute Arbiter, including
> commercially, as long as the license and attribution notices are preserved. See [NOTICE](NOTICE).

---

## Why Organizers Can Trust It

Arbiter is built for organizations that are careful about server security and data ownership.

- **Self-hostable by design:** run your own Discord application, bot token, and PostgreSQL database.
- **No required external SaaS:** local Docker Compose is enough for development and small event tests.
- **Org data stays in your database:** matches, logs, warnings, evidence metadata, and room mappings are
  stored in Postgres under your control.
- **User-install mode is deliberately limited:** it gives referees personal logging and lookup tools
  without managing roles, creating channels, closing matches, or mutating org state unless a valid org
  context and authorization exist.
- **Permission boundaries are documented:** see [Self-Hosting And Trust](docs/SELF_HOSTING.md) and
  [Security Policy](SECURITY.md).

For practical event flows, see [Referee Workflows](docs/WORKFLOWS.md).

---

## What Arbiter Handles

### Match Operations

- Components V2 match control panels with buttons for veto, start match, team rooms, score reports,
  pause logs, warnings, evidence, rulings, claims, disputes, timelines, referee calls, and closing.
- Flexible match formats from BO1 through large custom formats (`best_of` 1-99).
- Veto formats for series map picks, final-map vetoes, and manual picks.
- Built-in rules presets for SEL 2025 rulebooks, common tactical shooters, Overwatch mode rotation,
  and format-only presets for games where map vetoes do not apply.
- Custom per-server presets with `/preset create`, stored in the database and available through
  match-create autocomplete.
- Referee assignment, match claiming, targeted referee paging, and on-shift routing.
- Forfeit, DQ, no-show, admin-loss, cancellation, and disputed-match workflows.

### Match Rooms And Team Rooms

- Shared match text and voice rooms can be created under the org's configured category.
- Team roles can be passed during `/match-admin create`, so only the correct team members can see
  their team room.
- Private per-team text and voice rooms include player-safe controls for Call Ref, Evidence,
  Dispute, and optional player score reports.
- When a match closes, Arbiter archives text/voice-chat history to the match-log channel before
  deleting match/team rooms.

### Scores, Evidence, Warnings, And Logs

- Referee score reporting supports whole-match, map/game, round, set, and custom scoring notes.
- Score modals require or support screenshot proof depending on the workflow.
- Player score reports can be enabled per match and then reviewed by referees.
- Evidence modals support URLs, Discord file uploads, and multi-player selection where Discord
  allows it.
- Evidence can be mirrored to a configured evidence-vault channel so Discord ephemeral upload links
  do not become the only reference.
- Warning workflows track player/team infraction counts and can DM referee receipts or player
  notices when requested.
- Pause logs support team, technical, admin, tactical, emergency, and other pause types, with resume
  timestamps and pause-ledger summaries.
- Referee notes, handoffs, incidents, roster issues, technical issues, and warning references can be
  logged without leaving Discord.

### Battle-Royale Operations

Arbiter has a separate BR workflow for games such as Apex Legends, Fortnite, Free Fire, PUBG, and
PUBG Mobile.

- `/br create` creates an N-team lobby with placement points, kill points, planned game count, and
  optional team-role mappings.
- The BR standings board includes controls for Log Game, Adjust/Penalty, Pause, Warn, Evidence,
  Note, Team Rooms, Dispute, Call Ref, and Close.
- The Log Game modal pre-fills every team as `Team Name placement kills`, so refs can usually change
  only the numbers from a scoreboard screenshot.
- Referee adjustments can add or deduct points/kills and are folded directly into standings.
- BR warnings, pauses, disputes, evidence, and notes are logged to match-log/evidence channels and
  reflected on the standings board.
- BR team rooms create or sync one category per team, with that team's text channel and voice
  channel grouped together.
- Existing roles are resolved by stored ID, exact team name, `[LOBBY] Team Name`, or bracket-prefixed
  names such as `[EWC24 Apex] Team Falcons`.
- If some team roles are missing, Arbiter asks whether to create missing roles or continue with only
  the roles it could safely sync.
- BR room provisioning uses bounded concurrency and bulk permission overwrites so large lobbies do
  not blast Discord with unnecessary per-permission requests.
- BR modal submits defer immediately before slow work, avoiding Discord's 3-second interaction
  timeout on 18-20 team score submissions.
- Closing a BR lobby archives team-room transcripts and deletes team channels/categories.

### User-Installed Companion Mode

User-installed commands are intentionally safer than guild-installed admin commands.

- Players can look up matches, link profiles, check in, submit evidence, and call refs.
- Referees can use `/ref-my` from supported user-install contexts for assigned or authorized work:
  dashboard, score, score review, pause, evidence review, roster review, rule search, logging, and
  shift handoff.
- `/log` provides standalone matchless logging for external tournaments where Arbiter is not in the
  server. It can log notes, scores, evidence, warnings, and show previous logs.
- User-installed commands never create channels, manage roles, close matches, or mutate admin state
  unless a valid org/match context exists and the user is authorized.

---

## Discord Install Modes

Arbiter registers commands with Discord application command install contexts:

- **Guild install:** org setup, match admin, BR admin, rooms, score review, rosters, rulebook, and
  other server operations.
- **User install:** player/referee companion commands that work in DMs, private channels, and other
  safe contexts.

Runtime permission checks still matter. Even if Discord exposes a command, Arbiter resolves the org,
match, user profile, DB membership, assigned referee, and guild roles before allowing privileged
actions.

---

## Requirements

- Node.js 22.12 or newer (`.nvmrc` included)
- Docker for local PostgreSQL, or any PostgreSQL instance
- A Discord application and bot token

---

## Local Setup

Install dependencies and start Postgres:

```bash
npm install
docker compose up -d
cp .env.example .env
```

On Windows, use:

```powershell
copy .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DATABASE_URL=postgresql://esports:esports@localhost:5432/esports_admin_bot?schema=public
DISCORD_DEV_GUILD_ID=optional-guild-id-for-fast-command-registration
```

Generate Prisma, apply migrations, deploy commands, and run the bot:

```bash
npm run db:generate
npm run db:migrate
npm run deploy:commands
npm run dev
```

For a normal non-watch process:

```bash
npm start
```

---

## First Server Setup

In the Discord server where Arbiter is installed, run:

```text
/org setup auto_create:true
```

The setup flow can create or save:

- admin role
- referee role
- match category
- match-log channel
- evidence-vault channel

You can also provide existing roles/channels manually instead of auto-creating them.

Use `/org member` to save org admins/referees in the database. This matters for user-installed
contexts where Discord role data may not be available.

---

## Command Reference

### Guild-Installed Org Commands

| Command | Purpose |
|---|---|
| `/org setup` | Configure org roles/channels, with optional auto-create. |
| `/org member` / `/org members` | Save and list org admins/referees in the DB. |
| `/match-admin create` | Create a match panel with teams, format, rules preset, veto format, roles, and player score option. |
| `/match-admin panel` | Re-post and re-track a match control panel. |
| `/match-admin list` | List recent matches in the org. |
| `/match-admin ruling` | Apply forfeit, DQ, no-show, admin loss, or cancellation. |
| `/score report` | Referee score report with screenshot proof. |
| `/score pending` / `/score review` | Review player score reports. |
| `/warn issue` / `/warn summary` | Issue warnings and review infraction history. |
| `/pause ledger` | Show pause usage and remaining pause budget. |
| `/ref dashboard` | View active matches, pending scores, rosters, evidence, and reminders. |
| `/ref assign` / `/ref unassign` | Assign or clear match referees. |
| `/ref-log add` | Log referee notes with optional attachments and references. |
| `/roster submit/view/approve/reject/lock/unlock` | Manage roster workflow. |
| `/rule search/add/delete` | Search and maintain the server rulebook. |
| `/preset create/list/delete` | Manage custom map/rules presets. |
| `/history team/player` | Review operational history for teams or players. |
| `/evidence submit/review` | Submit or review match evidence. |
| `/ref-shift` | Mark yourself available or unavailable for referee pages. |

### Battle-Royale Commands

| Command | Purpose |
|---|---|
| `/br create` | Create a BR lobby with teams, game, planned games, scoring table, and optional team-role map. |
| `/br result` | Open the pre-filled game result modal for a lobby/game number. |
| `/br standings` | Re-post the live standings board and track it as the control panel. |
| `/br rooms` | Points refs back to the control panel's Team Rooms flow for safe room provisioning. |
| `/br list` | List recent BR lobbies in the org. |

BR control-board buttons:

- Log Game
- Adjust/Penalty
- Pause
- Warn
- Evidence
- Note
- Team Rooms
- Dispute
- Call Ref
- Close

### User-Installed Companion Commands

| Command | Purpose |
|---|---|
| `/match lookup` | Show player-safe match details from a public code. |
| `/profile link` / `/profile view` | Link and view game accounts. |
| `/checkin` | Check into a match by public code. |
| `/call-ref` | Page available or assigned referees. |
| `/evidence submit` | Submit evidence from a safe user-installed context. |
| `/ref-my dashboard` | Show your assigned/authorized referee work across orgs. |
| `/ref-my log` | Log a referee note with optional file and DM references. |
| `/ref-my score` | Apply a score with optional screenshot proof. |
| `/ref-my score-review` | Review pending player score reports. |
| `/ref-my pause` | Log a pause and schedule a resume reminder when possible. |
| `/ref-my evidence` | Review evidence for assigned/authorized matches. |
| `/ref-my roster` | View, approve, reject, lock, or unlock rosters. |
| `/ref-my rule` | Search an org rulebook from a user-install context. |
| `/ref-my handoff` | Send a shift handoff note to logs and optionally DM the next ref. |
| `/log note/score/evidence/warning/list` | Standalone referee logging for external events with no match record. |

---

## Screenshots

| Match control panel | Map veto |
|---|---|
| ![Match control panel](docs/images/match-panel.png) | ![Map veto](docs/images/veto.png) |

| Score reporting | Match log |
|---|---|
| ![Score report modal](docs/images/score-report.png) | ![Match log embed](docs/images/match-log.png) |

| Evidence vault | Standalone logging |
|---|---|
| ![Evidence vault embed](docs/images/evidence-vault.png) | ![Standalone log receipt](docs/images/standalone-log.png) |

| Pause ledger | Warning summary |
|---|---|
| ![Pause ledger output](docs/images/pause-ledger.png) | ![Warning summary output](docs/images/warn-summary.png) |

| Team history | Player history |
|---|---|
| ![Team history output](docs/images/history-team.png) | ![Player history output](docs/images/history-player.png) |

| Battle-royale lobby setup | Battle-royale live standings |
|---|---|
| ![BR lobby setup](docs/images/br-lobby-pending.png) | ![BR live standings](docs/images/br-lobby-game-1.png) |

---

## Architecture

```text
src/
  commands/        Slash commands and install-context policy
  db/              Prisma client
  interactions/    Buttons, selects, modals, autocomplete, and room workflows
  services/        Org, match, BR, referee, roster, scoring, evidence, preset, and profile logic
  ui/              Components V2 panels and modals
  utils/           Custom IDs, message refresh, and view mapping
prisma/
  schema.prisma    Multi-tenant data model
  migrations/      SQL migration history
test/              Node test runner specs
docs/
  PRESETS.md       Built-in preset reference
```

Core model boundaries:

- `Organization` maps one Discord guild to one tenant.
- `OrgSettings` stores the org's admin/referee roles and operational channels.
- `UserProfile` is global and can participate in multiple orgs.
- `Match` and all match operations belong to an organization.
- `BrLobby`, `BrTeam`, `BrGameResult`, `BrAdjustment`, and `BrLog` handle battle-royale events.
- `RulesPreset` stores per-org custom rules/map presets.
- `StandaloneLog` stores user-owned, matchless logs for external events.

---

## Reliability Notes

- Components V2 messages are sent with `MessageFlags.IsComponentsV2`.
- Display-component messages intentionally do not mix legacy content/embeds with Components V2
  payloads.
- Long BR modal submits defer immediately before slow DB/log/panel work, then edit the deferred
  reply. This avoids Discord `Unknown interaction` errors caused by the 3-second acknowledgement
  window.
- BR team-room provisioning uses bounded concurrency and bulk permission overwrite updates instead of
  dozens of per-permission edits.
- The bot explicitly grants itself room access when it creates private rooms, so it can keep updating
  panels and archiving channels later.

---

## Verification

```bash
npm run check
npx prisma validate
```

`npm run check` runs syntax checks and the Node test suite. Current coverage includes:

- command registration and install-context policy
- admin/referee permission gates
- match panel and veto helpers
- score/evidence/warning/pause modal support
- user-installed player and referee companion workflows
- BR standings, referee controls, modal defer behavior, and team-room role/category syncing
- preset coverage and match-view mapping

GitHub Actions runs `npm ci`, `npx prisma validate`, and `npm run check` on pushes and pull requests.

---

## Security And Operations

- Do not commit `.env` or production bot tokens.
- Rotate tokens if they were shared in a test environment.
- Give the bot only the permissions it needs: application commands, send messages, manage channels,
  manage roles, attach files, read message history, and voice channel access where room creation is
  used.
- Keep the bot role above roles it must create or manage.
- PostgreSQL is the source of truth; Redis is not required for the current stage.

---

## Support And Sponsoring

Arbiter is free and open source under Apache-2.0, including for commercial use. If it helps your
league, event, community, or organization, please consider sponsoring development:

[Sponsor the project on GitHub](https://github.com/sponsors/devabdullahs)

- Author: Abdullah
- GitHub: [@devabdullahs](https://github.com/devabdullahs)
- Discord: [@monster20](https://discord.com/users/170115708871507970)
- Repository: [devabdullahs/Arbiter](https://github.com/devabdullahs/Arbiter)

---

## License

Licensed under the [Apache License 2.0](LICENSE).

In plain terms, anyone may use, modify, and distribute this software, including commercially, free of
charge. In return, you must:

- include a copy of the license,
- preserve copyright, license, and attribution notices, and
- state in modified files that you changed them.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for the full legal text.
