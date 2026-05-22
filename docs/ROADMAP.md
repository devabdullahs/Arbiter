# Roadmap

## Shipped

### Core Platform

- Multi-tenant organizations: one Discord guild maps to one org.
- `/org setup` for roles, categories, match logs, and evidence channels, with auto-create support.
- Guild-install and user-install command contexts.
- PostgreSQL and Prisma persistence with migration history.
- Self-hosting and trust documentation for organizers.

### Match Operations

- Match creation and live Components V2 control panels.
- Temporary per-match text and voice rooms.
- Optional private team rooms with team-role access.
- Channel transcript archiving to the match-log channel on close.
- Map veto flows: final-map vetoes, series map picks, and manual picks.
- Built-in SEL presets for Valorant, OW2, R6S, COD BO6, Rocket League, PUBGM, EAFC, and related
  women/wildcard variants.
- Custom per-server presets through `/preset`.
- Referee assignment, claiming, and targeted Call Ref routing.
- Forfeit, DQ, no-show, admin-loss, cancellation, and disputed-match workflows.

### Refereeing And Adjudication

- Referee score reporting with screenshot proof and rich match-log records.
- Optional player score reporting per match.
- Warnings, pause logs, rulings, referee notes, and handoff logs.
- Pause-budget ledger per team.
- Infraction summaries with admin-role escalation.
- Match-history views by team and player.
- Evidence vault with attachment references and multi-player tagging.
- Evidence storage provider abstraction, with Discord vaulting as the default provider.
- Roster submission and review.
- Searchable per-server rulebook.
- Referee shifts and user-installed referee companion commands.
- Standalone matchless logging for external events.

### Battle-Royale Operations

- BR referee control boards with scoring, standings, adjustments, pauses, warnings, evidence, notes,
  disputes, referee calls, and close/finalize.
- Prefilled result modal so refs usually edit only placement and kill numbers.
- Point/kill adjustments folded directly into standings.
- BR team-room creation with one category per team and grouped text/voice channels.
- Existing role sync by stored ID, exact team name, lobby-prefixed name, or bracket-prefixed name.
- Safe prompts for missing role creation/sync.
- Bounded concurrency and bulk permission overwrites for large lobby room provisioning.
- Deferred modal submits for 18-20 team scoring workflows.

### Player Companion

- Player-safe match lookup, check-in, evidence submission, and referee calls.
- Game-account linking.
- User-install mode for safe referee/player tools where the bot is not in the server.

## Planned

### Trust And Adoption

- Short demo video showing match panel, BR lobby, evidence vault, and standalone logging.
- More real-event walkthroughs for common tournament formats.
- Example deployment guide for a small VPS.
- Optional sample seed data for local demos.

### Automation And Integrations

- Riot account and roster validation.
- Game result polling after match completion where public/developer APIs allow it.
- Tournament-platform sync and bracket update webhooks.
- Evidence mirroring to external object storage such as S3, R2, or GCS.

### Operations And Scale

- Web configuration dashboard for org settings.
- Hosted multi-org deployment option.
- Queue or worker layer if live polling, rate limits, or scheduled jobs need it.
