# Production deployment

The repository now contains both supported deployment paths:

- **Render**: `render.yaml` + `backend/Dockerfile`
- **Linux VPS**: `backend/docker-compose.prod.yml` + Caddy automatic HTTPS

## Required production values

Create `backend/.env.production` from `backend/.env.production.example` and set:

1. `DATABASE_URL` to the Supabase pooler on port `6543` with
   `pgbouncer=true&connection_limit=10`.
2. `JWT_SECRET` to a random value with at least 32 characters.
3. `REDIS_URL` to `redis://redis:6379` for the VPS stack, or a managed
   `rediss://...` URL such as Upstash for Render.
4. `API_DOMAIN` to the real API hostname, for example `api.example.com`.
5. `ACME_EMAIL` to the address used for certificate renewal notices.

`CORS_ORIGIN=*` is supported for the Android-only API. For browser clients,
replace it with a comma-separated allow-list of HTTPS origins.

## VPS deployment

From `backend/` on the server:

```bash
cp .env.production.example .env.production
# edit .env.production
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/api/v1/health/ready
```

Create the DNS record before the first HTTPS request:

```text
Type: A
Name: api
Value: <VPS public IPv4>
```

Caddy terminates TLS on ports 80/443 and forwards only to the private API
container. Redis is private to the Compose network and persists in a volume.

## Render deployment

1. Connect the repository and select the root `render.yaml` blueprint.
2. Set `DATABASE_URL` and `REDIS_URL` in the Render dashboard.
3. Deploy and copy the generated `onrender.com` hostname.
4. Add a custom-domain CNAME such as `api` → the generated Render hostname.
5. Verify `/health`, `/api/v1/health`, and `/api/v1/health/ready`.

Render supplies the HTTPS certificate and the blueprint uses `/health` as the
container health check. Set `CORS_ORIGIN` to the real browser origins if a web
dashboard is added.

## Android production APKs

The checked-in Thunder eSports configs use `https://api.alphaesports.in/api/v1`.
The production hostname can be overridden without changing branding files:

```bash
cd android
./gradlew :app-player:assembleDebug :app-admin:assembleDebug \
  -PapiBaseUrl=https://api.example.com/api/v1
```

For a white-label client, set `API_BASE_URL` while running the existing
`package_client.bat` command. The Gradle task validates that the override is
HTTPS and ends with `/api/v1`. Android cleartext traffic remains disabled for
production domains.

## Operational checks

- `/health` is a process liveness check and remains 200 when Redis is down.
- `/health/ready` requires PostgreSQL and reports Redis as `degraded` when the
  optional lock acceleration layer is unavailable.
- `/health/redis` returns 503 when Redis cannot be reached.
- Rate limiting uses the real client IP when `TRUST_PROXY=true` behind Render
  or Caddy.
- The in-process match sweep starts on boot and repeats every 60 seconds.
