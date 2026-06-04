# Deployment

## TL;DR — single command

```bash
cp .env.example .env
# Fill in JWT_SECRET, ENCRYPTION_KEY, GENX_API_KEY
docker compose up -d --build
```

The stack is two containers:

| Service | What it is | Port |
| ------- | ---------- | ---- |
| `db`    | MariaDB 11 | (internal) |
| `app`   | Next.js standalone build | `${APP_PORT:-3000}` |

## Required env

You must set these before bringing the stack up:

| Key | Notes |
| --- | ----- |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (must be 64 hex chars) |
| `GENX_API_KEY` | Your GenX key. Without it, AI features are clearly disabled in the UI |
| `NEXTAUTH_URL` | Full external URL of your deployment, e.g. `https://coder.example.com` |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` / `MYSQL_ROOT_PASSWORD` | Override defaults for production |

Optional overrides:

| Key | Default |
| --- | ------- |
| `APP_PORT` | `3000` |
| `GENX_BASE_URL` | `https://query.genx.sh/v1` |
| `GENX_DEFAULT_CHAT_MODEL` | `gpt-4o-mini` |
| `GENX_DEFAULT_CODING_MODEL` | `gpt-4o` |
| `JWT_EXPIRES_IN` | `7d` |

## Healthcheck

`GET /api/health` returns:

```json
{ "app": "ok", "db": "ok", "timestamp": "..." }
```

This is used by Docker `HEALTHCHECK` and is safe to point your reverse
proxy / monitoring at.

## Behind a reverse proxy

If you put nginx / Caddy / Traefik in front of the app, forward both the
host and protocol headers, and make sure the `secure` cookie flag works
(the app sets `secure=true` when `NODE_ENV=production`).

Minimal Caddy block:

```
coder.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

## First deploy checklist

- [ ] `cp .env.example .env` and fill the required keys
- [ ] `docker compose up -d --build`
- [ ] `curl https://your-host/api/health` returns `app:ok,db:ok`
- [ ] Register a user, paste a GitHub PAT, see ✓ Connected badge
- [ ] In settings, "Re-test key" lights up GenX ✓ Key valid
- [ ] Open Workbench, pick a small repo, type "Audit this repo" → Plan & propose
- [ ] Approve → PR shows up in `/dashboard/pull-requests`

## Updating

```bash
git pull
docker compose build app
docker compose up -d app
```

Prisma `db push` runs automatically on container start, so schema
migrations are applied before the server boots.

## Backups

Back up the MariaDB volume `amarktai_db_data` regularly:

```bash
docker compose exec db sh -c 'mariadb-dump -uroot -p$MARIADB_ROOT_PASSWORD --all-databases' > backup.sql
```

Restore with `docker compose exec -T db mariadb -uroot -p$MARIADB_ROOT_PASSWORD < backup.sql`.
