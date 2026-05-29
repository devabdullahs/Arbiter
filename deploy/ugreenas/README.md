# Arbiter UGOS / TrueNAS Docker Bundle

Run Arbiter (Discord bot + web dashboard + Postgres) on a UGREEN NAS (UGOS),
TrueNAS, or any Docker host. Images are built in CI and published to **GitHub
Container Registry (GHCR)**; the NAS just pulls them.

> Run deploy commands over **SSH** from inside `deploy/ugreenas/`, not the NAS
> Container Manager GUI (the GUI's pull/build handling is unreliable here).

## How images are published

`/.github/workflows/deploy-images.yml` builds `arbiter-bot` and `arbiter-web`
and pushes them to GHCR on every push to `main` (or via "Run workflow"):

- `ghcr.io/<owner>/arbiter-bot:latest` (+ `:<git-sha>`)
- `ghcr.io/<owner>/arbiter-web:latest` (+ `:<git-sha>`)

So the deploy loop is: **push code → CI builds & pushes → NAS pulls.**

### Make the packages pullable by the NAS

GHCR packages are **private** by default. Pick one:

- **Public (simplest):** on GitHub → your profile → Packages → `arbiter-bot` /
  `arbiter-web` → Package settings → change visibility to **Public**. The NAS
  then pulls with no login.
- **Private:** on the NAS, `docker login ghcr.io -u <github-user>` with a
  Personal Access Token that has `read:packages` as the password.

## Deploy on the NAS

```sh
cp .env.docker.example .env.docker
# Fill it in. POSTGRES_PASSWORD must be URL-safe (letters/digits/-/_), no $.

docker compose -f docker-compose.ugreenas.yml pull
docker compose -f docker-compose.ugreenas.yml up -d
```

To update after CI publishes a new image: `pull` again, then `up -d`.

The compose creates:

- `arbiter-db` — Postgres on a private bridge network.
- `arbiter-migrate` — one-shot Prisma migration job (`db:deploy`).
- `arbiter-bot` — the Discord bot and sync worker.
- `arbiter-web` — the dashboard, on the internal bridge **and** your `macvlan`.

Uploads persist under `./data/uploads`; Postgres data under `./data/postgres`.

### Pinning a version

Set `ARBITER_BOT_IMAGE` / `ARBITER_WEB_IMAGE` in `.env.docker` to a specific
`…:<git-sha>` tag instead of `:latest` to pin a known-good build.

### Offline / no-registry fallback (load tarballs)

If you can't use a registry, build the images elsewhere, `docker save | gzip`
them, copy to the NAS, then load and point the compose at them:

```sh
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://arbiter.moonbot.info \
  --build-arg NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX \
  -f deploy/ugreenas/web.Dockerfile \
  -t arbiter-web:local .
docker load -i arbiter-bot.tar.gz
docker load -i arbiter-web.tar.gz
# in .env.docker:
#   ARBITER_BOT_IMAGE=arbiter-bot:local
#   ARBITER_WEB_IMAGE=arbiter-web:local
docker compose -f docker-compose.ugreenas.yml up -d   # no pull needed
```

## Troubleshooting

| Error | Cause & fix |
|---|---|
| `pull access denied` / `denied` / `unauthorized` | The GHCR package is private and the NAS isn't logged in — make it public or `docker login ghcr.io` (see above). |
| `manifest unknown` / image not found | CI hasn't published yet (check the Actions run), or `ARBITER_*_IMAGE` points at a tag that doesn't exist. |
| `password authentication failed for user "arbiter"` | `./data/postgres` was initialized with a **different** password (Postgres only honors `POSTGRES_PASSWORD` on first init, and it's a **bind mount** so `down -v` won't clear it). Run `down`, then `rm -rf data/postgres` (sudo / File Station), then `up -d`. |
| `invalid port number in database URL` | `POSTGRES_PASSWORD` has a URL-special char (`/ : @ # ? % &` or space). Use a URL-safe password, then re-init the DB (row above). |
| `The "P" variable is not set` | A value in `.env.docker` contains a literal `$`. Escape it as `$$`, or remove `$`. |
