# Deployment Guide

This guide describes a small self-hosted production setup for Arbiter. It assumes one Linux VPS,
PostgreSQL, Node.js 22, and a process manager.

## Recommended Shape

- One Discord application per production organization or hosted environment
- One PostgreSQL database
- One Linux user dedicated to the bot
- One process manager: `systemd` or PM2
- A separate development Discord application and test guild

Arbiter does not require Redis for the current feature set.

## 1. Prepare The Server

Ubuntu example:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates postgresql postgresql-contrib
```

Install Node.js 22 or newer. One common option is `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

Create a dedicated app user if you do not already have one:

```bash
sudo adduser --disabled-password --gecos "" arbiter
sudo usermod -aG sudo arbiter
```

## 2. Create The Database

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER arbiter WITH PASSWORD 'replace-with-a-long-password';
CREATE DATABASE arbiter OWNER arbiter;
\q
```

Your production `DATABASE_URL` will look like:

```env
DATABASE_URL=postgresql://arbiter:replace-with-a-long-password@localhost:5432/arbiter?schema=public
```

## 3. Clone And Install

```bash
git clone https://github.com/devabdullahs/Arbiter.git
cd Arbiter
npm ci
```

Create `.env`:

```bash
cp .env.example .env
nano .env
```

Required:

```env
DISCORD_TOKEN=your-production-bot-token
DISCORD_CLIENT_ID=your-application-client-id
DATABASE_URL=postgresql://arbiter:replace-with-a-long-password@localhost:5432/arbiter?schema=public
DISCORD_DEV_GUILD_ID=
```

Do not commit `.env`.

## 4. Apply Migrations And Register Commands

```bash
npm run db:generate
npm run db:migrate
npm run deploy:commands
npm run check
```

For a production database, use Prisma's deploy command instead of the local development migration
flow:

```bash
npm run db:deploy
```

## 5. Run With systemd

Create a service:

```bash
sudo nano /etc/systemd/system/arbiter.service
```

Example:

```ini
[Unit]
Description=Arbiter Discord esports referee bot
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/home/arbiter/Arbiter
ExecStart=/home/arbiter/.nvm/versions/node/v22.12.0/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Adjust the Node path to match `which node`.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable arbiter
sudo systemctl start arbiter
sudo systemctl status arbiter
```

Logs:

```bash
journalctl -u arbiter -f
```

## 6. Discord Production Checklist

- Invite the bot with only the permissions your workflows need.
- Grant Manage Channels only if match/BR room automation is used.
- Grant Manage Roles only if Arbiter should create or sync team/ref/admin roles.
- Keep the bot role above roles it must manage.
- Run `/org setup` in the production server.
- Use `/org member` to explicitly save trusted admins and referees.
- Test `/match-admin create`, `/br create`, score proof, evidence, and close cleanup in a private
  category before the event.

## 7. Updating Arbiter

```bash
cd /home/arbiter/Arbiter
git pull
npm ci
npm run db:deploy
npm run deploy:commands
npm run check
sudo systemctl restart arbiter
```

If commands changed, Discord global command propagation can take time. For fast testing, use
`DISCORD_DEV_GUILD_ID` in a development environment.

## 8. Backups And Token Rotation

Back up Postgres before major events and before migrations:

```bash
pg_dump "$DATABASE_URL" > arbiter-backup.sql
```

Rotate immediately if a token is exposed:

1. Regenerate the bot token in the Discord Developer Portal.
2. Update `.env`.
3. Restart the process.
4. Review logs for accidental token exposure.

## 9. Optional Demo Seed

For staging and screenshots:

```bash
npm run demo:seed
```

See [Demo Data](DEMO_DATA.md) for what it creates.
