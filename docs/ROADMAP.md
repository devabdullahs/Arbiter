# Roadmap

## Phase 1: Multi-Tenant MVP

- Postgres + Prisma persistence
- Guild install and user install command contexts
- Per-org setup for roles and channels
- Match creation and live control panel
- Player-safe match lookup, check-in, evidence, and referee calls
- Score, pause, warning, and evidence modals for authorized org staff

## Phase 2: Tournament Operations

- Team roster database
- Player account linking and admin approval
- Pause budget ledger per team
- Infraction thresholds and head-admin escalation
- Match history view by team/player
- Transcript export for disputes

## Phase 3: API Automation

- Riot account and roster validation
- Game result polling after match completion
- Tournament platform sync
- Evidence upload mirror to S3/R2/GCS
- Bracket update webhooks

## Phase 4: Multi-Org Product

- Per-server configuration dashboard
- Tenant-safe database schema
- Audit log and moderation permissions
- Match templates per title
- Billing and hosted deployment
