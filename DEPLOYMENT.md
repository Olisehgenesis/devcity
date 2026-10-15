# DEPLOYMENT — DEVCITY26

**Last Updated:** 2026-10-15
**Project:** Location-based social app for Devcon Mumbai with blockchain integration

This document describes how DEVCITY26 is deployed to production. The repository is **public**, so it contains no secrets — only deployment topology, the SSH alias, and the commands operators run.

---

## Production server

| Item | Value |
|---|---|
| SSH alias | `ssh sovlend` |
| SSH user | `root` |
| App directory | `/opt/devcity` |
| Git repo | `/opt/devcity/repo` |
| Reverse proxy | Caddy (container `sovlend-caddy-1`) on ports 80/443 |

> The `sovlend` SSH host is defined in `~/.ssh/config`. Always connect via the
> alias — never type the raw server IP into a public document.

---

## Topology (docker containers)

| Container | Image | Role | Local port |
|---|---|---|---|
| `repo-app-1` | `devcity-app:<commit>` | Next.js app (standalone) | `127.0.0.1:3001` → `3000` |
| `repo-postgres-1` | `postgres:17-alpine` | PostgreSQL database | `127.0.0.1:55432` → `5432` |
| `sovlend-caddy-1` | `caddy:2-alpine` | HTTPS reverse proxy / TLS | `80`, `443` |

Caddy terminates TLS and proxies to the app container. Database traffic stays on
the loopback interface and is never exposed publicly.

---

## How to deploy

### 1. Push the code

From a local clone:

```bash
git add -A
git commit -m "describe your change"
git push origin master
```

### 2. Update the server

SSH in and run the deploy script, which pulls the latest `master`, rebuilds the
app image, applies pending Prisma migrations, and restarts the app:

```bash
ssh sovlend
cd /opt/devcity/repo
./deploy.sh
```

`deploy.sh` does the equivalent of:

```bash
git pull --ff-only origin master
docker compose build app
docker cp prisma repo-app-1:/app/prisma
docker exec repo-app-1 npx prisma migrate deploy
docker compose up -d app
curl -s http://127.0.0.1:3001/api/health
```

The final `curl` returns the health check; a `200` with an `ok` body means the
deploy succeeded.

### 3. Verify

```bash
curl -s http://127.0.0.1:3001/api/health
```

---

## Database migrations

Migrations live in `prisma/migrations`. They are applied automatically by
`deploy.sh` inside the running app container:

```bash
docker exec repo-app-1 npx prisma migrate deploy
```

For local development:

```bash
npm run db:migrate      # prisma migrate dev (creates migration)
npm run db:generate     # prisma generate
```

> New migrations are committed to the repo and applied on the server by the
> deploy script — you do **not** need to run migrations manually on the server.

---

## Health endpoint

The app exposes a health check at `/api/health` (used by the container
healthcheck and by Caddy). The deploy script curls it to confirm a successful
restart.

---

## Notes & safety

- The repository is **public** — never commit `.env`, keys, or any secret.
  Secrets are managed with `dotenvx` (`.env.encrypted`) and read at runtime via
  `process.env.*`.
- See `ENV_SECURITY.md` for environment/secret handling and `USE_WALLET.md`
  for wallet-key safety rules (the private key never leaves the device/process).
- Connect to the server only via the `sovlend` SSH alias; the raw IP is never
  committed to this public repository.
