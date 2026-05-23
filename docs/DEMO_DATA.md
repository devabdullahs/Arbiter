# Demo Data

Arbiter includes a local seed script for repeatable demos, screenshots, and smoke tests. It creates a
clearly marked fake organization with a Valorant match, an Apex Legends BR lobby, referee logs,
warnings, evidence metadata, roster submissions, rulebook entries, audit records, and standalone
referee logs.

## Run It

Start Postgres and apply migrations first:

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
```

Seed the demo:

```bash
npm run demo:seed
```

The script resets only the demo organization whose guild ID is configured by `DEMO_DISCORD_GUILD_ID`
or, by default, `arbiter-demo-guild`.

## What It Creates

- Organization: `Arbiter Demo Org`
- Org settings with fake role/channel IDs
- Demo admin, referee, and player profiles
- Referee shift marked on-shift
- Rulebook entries for technical pauses and evidence proof
- Valorant tournament and BO3 match:
  - public code: `DEMOBO3`
  - teams: `Sentinels` vs `Fnatic`
  - status: `LIVE`
  - score: `1-0`
  - roster submissions, veto actions, pause log, warning, evidence, score report, audit logs
- Apex Legends BR lobby:
  - public code: `DEMOAPEX`
  - 18 teams
  - one scored game
  - point adjustment
  - pause, warning, evidence, note, and audit logs
- Standalone `/log` examples for external tournaments

## Optional Real Test Guild

For a Discord test server, point the demo org at that guild before seeding:

```powershell
$env:DEMO_DISCORD_GUILD_ID="your-test-guild-id"
npm run demo:seed
```

Only do this for a disposable test guild or local development database. The script deletes and
recreates the demo organization for the configured guild ID so the seed stays repeatable.

## Useful Follow-Up Commands

In Discord:

```text
/match lookup code:DEMOBO3
/br standings code:DEMOAPEX
/log list
```

If the bot is installed in the same test guild and `/org setup` uses real channels/roles, you can
also create fresh panels with:

```text
/match-admin panel code:DEMOBO3
/br standings code:DEMOAPEX
```

