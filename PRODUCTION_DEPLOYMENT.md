# Production Deployment Guide

Short runbook for `cities-learning-explorer` production on `194.163.151.34` (`flo`), including self-hosted Plausible.

Traefik is deployed separately; this repo only provides service labels for routing.

## One-time setup

1. Copy env template and set values:
   ```bash
   cp .env.prod.example .env.prod
   ```
2. Generate secrets:
   ```bash
   openssl rand -base64 48   # PLAUSIBLE_SECRET_KEY_BASE
   tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32; echo   # PLAUSIBLE_DB_PASSWORD (URL-safe)
   ```
3. Ensure DNS points to this server for:
   - app host (e.g. `cities-explorer.eubucco.com`)
   - analytics host (e.g. `analytics.cities-explorer.eubucco.com`)

## Deploy (server workflow)

Use SSH agent forwarding and run exactly this:

```bash
ssh -A -t flo@194.163.151.34
sudo -E git -C /home/cities-learning-explorer pull --ff-only
sudo -i
cd /home/cities-learning-explorer
docker compose --env-file .env.prod up --build -d
docker compose ps
```

## First Plausible login

Open `PLAUSIBLE_BASE_URL` and create the first account.  
If blocked, set `PLAUSIBLE_DISABLE_REGISTRATION=false`, redeploy, create account, set it back to `true`, redeploy.

## Notes

- Analytics is production-only and loads only when both `VITE_PLAUSIBLE_DOMAIN` and `VITE_PLAUSIBLE_SCRIPT_SRC` are set.
- Persisted Docker volumes: `plausible-db-data`, `plausible-events-data`, `plausible-data`.

## Minimal maintenance

- Update and redeploy image tags (`plausible`, `postgres`, `clickhouse`) regularly.
- Back up the three Plausible volumes.
- Keep host/Docker patched and protect `.env.prod`.
