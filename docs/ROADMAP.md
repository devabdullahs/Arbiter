# Roadmap

## ✅ Shipped

**Core platform**
- Multi-tenant orgs (one Discord guild → one org), with `/org setup` for roles and channels (auto-create supported)
- Guild-install and user-install command contexts
- PostgreSQL + Prisma persistence, with migration history

**Match operations**
- Match creation and live control panel (`/match-admin create`)
- Temporary per-match text + voice rooms, with optional team-role access, cleaned up on close
- Channel transcript archiving to the match-log channel on close
- Map veto: single final-map ban, series map picks, and manual picks
- Rules presets: built-in (Generic, Overwatch mode rotation, Valorant) **and** custom per-server presets via `/preset`

**Refereeing & adjudication**
- Referee score reporting with screenshot proof + rich match-log embeds (image inline)
- Optional player score reporting (per match)
- Warnings, pause logs (with a live "resumes at" timestamp), and rulings (forfeit / DQ / no-show / admin loss / cancelled)
- Pause-budget ledger per team (`/pause ledger`)
- Infraction thresholds with automatic admin-role escalation (`/warn summary` + match-log alerts)
- Match-history views by team/player (`/history`)
- Evidence vault with re-hosted (persistent) attachments and multi-player tagging
- Evidence storage provider abstraction, with Discord vault as the default provider
- Referee assignment / claim (`/ref`); Call Ref routes only to the assigned referee once claimed
- Dispute escalation (sets the `DISPUTED` status and alerts referees)
- Roster submission and review (`/roster`)
- Searchable per-server rulebook (`/rule`)
- Referee shifts (`/ref-shift`) and the user-installed referee companion (`/ref-my`)
- Standalone, matchless logging for external events (`/log`) — saved per referee and retrievable

**Player companion**
- Player-safe match lookup, check-in, evidence submission, and referee calls
- Game-account linking (`/profile`)

## 🔭 Planned

**Automation & integrations**
- Riot account and roster validation
- Game result polling after match completion
- Tournament-platform sync and bracket update webhooks
- Evidence mirroring to external storage (S3 / R2 / GCS)

**Operations & scale**
- Per-server configuration dashboard (web)
- Billing and hosted multi-org deployment
