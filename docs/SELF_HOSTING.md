# Self-Hosting And Trust

Arbiter is meant for esports organizations that cannot casually invite unknown hosted bots into an
official server. The safe deployment model is simple: the organization can run its own Discord
application, its own bot token, and its own database.

## What You Control

- The Discord application and bot token
- The PostgreSQL database
- The server roles and channel permissions
- Which commands are registered for guild install and user install
- Evidence retention policy and future storage provider configuration
- Deployment location, logs, backups, and token rotation

Arbiter does not require a hosted SaaS account for local use. Docker Compose starts a local Postgres
database, and Prisma migrations create the schema.

## Fast Local Start

```bash
npm install
docker compose up -d
cp .env.example .env
```

On Windows:

```powershell
copy .env.example .env
```

Fill in:

```env
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DATABASE_URL=postgresql://esports:esports@localhost:5432/esports_admin_bot?schema=public
DISCORD_DEV_GUILD_ID=optional-guild-id-for-fast-command-registration
```

Then run:

```bash
npm run db:generate
npm run db:migrate
npm run deploy:commands
npm run dev
```

## Discord Permissions

The bot only needs elevated server permissions when the org wants room automation.

Typical guild-install permissions:

- Use application commands
- Send messages
- Read message history
- Attach files
- Manage channels, only if match/BR room creation is used
- Manage roles, only if Arbiter should create or sync team/ref/admin roles
- Connect and view voice channels, only if voice rooms are used

Operational notes:

- Keep the bot role above any role it must create, assign, or manage.
- If you do not need automated rooms, do not grant Manage Channels.
- If you do not need role creation/sync, do not grant Manage Roles.
- Configure org channels and roles through `/org setup` instead of hard-coding them in `.env`.

## Data Stored

Arbiter stores operational tournament data in Postgres:

- Organizations and org settings
- User profiles and linked game accounts
- Matches, teams, match participants, BR lobbies, and BR teams
- Scores, check-ins, warnings, pause logs, disputes, rulings, and referee notes
- Evidence metadata, attachment references, and vault message references
- Match room and BR team room channel IDs for cleanup and transcript archiving

It does not need game-account passwords. If future API integrations are added, OAuth/API tokens should
be stored and rotated according to the tournament operator's policy.

## User-Install Mode

User-install mode is for referees and players who need lightweight tools where the bot is not in the
server.

Allowed examples:

- Personal referee logs with `/log`
- Match lookup by public code
- Check-in
- Evidence submission
- Call ref
- Assigned-referee dashboards when a valid org/match context exists

Blocked by design unless the bot has authorized guild/org context:

- Creating channels
- Managing roles
- Closing matches or BR lobbies
- Mutating scores as an admin/referee
- Deleting rooms
- Changing org settings

This keeps the companion mode useful without letting it act like a hidden server-management tool.

## Production Checklist

- Create a dedicated Discord application for the organization.
- Store `.env` outside git and rotate exposed tokens immediately.
- Use a managed or backed-up Postgres instance for real events.
- Run `npm run check` and `npx prisma validate` before deploying.
- Limit bot permissions to the workflows the event actually uses.
- Configure `/org setup` and `/org member` before live matches.
- Test room creation and cleanup in a private staging category.
- Decide how long to retain logs, transcripts, and evidence references.

