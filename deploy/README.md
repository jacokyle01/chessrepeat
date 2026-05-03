# VPS deployment

CI builds two images (`chessrepeat-backend`, `chessrepeat-frontend`),
pushes them to GitHub Container Registry, then SSHes to the VPS and
restarts the docker-compose stack. Caddy handles TLS.

## Architecture

```
                        ┌────────────────────────────────────┐
   internet ─────► 443 ─┤ caddy   (TLS + reverse proxy)      │
                        │   ├─ example.com     → frontend:80 │
                        │   └─ api.example.com → backend:8080│
                        ├────────────────────────────────────┤
                        │ frontend (nginx + static SPA)      │
                        │ backend  (Go binary, distroless)   │
                        │ postgres (pgdata volume)           │
                        └────────────────────────────────────┘
                          all on a single docker network
```

## One-time setup

### 1. DNS

Point both `example.com` and `api.example.com` (A records) at the
VPS public IP. Caddy will fail to provision certs if these don't
resolve when it boots.

### 2. VPS prep

On the VPS (Ubuntu 22.04+):

```sh
# install docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # log out and back in

# create the deploy directory and a service user
sudo mkdir -p /opt/chessrepeat
sudo chown $USER:$USER /opt/chessrepeat
```

### 3. `.env` on the VPS

```sh
cd /opt/chessrepeat
cp .env.example .env  # after the first deploy lands the file, OR
                      # paste the contents from your local copy
chmod 600 .env
```

Edit `.env`:
- `GH_OWNER` — your GitHub username/org
- `POSTGRES_PASSWORD` — set a real password
- `GOOGLE_CLIENT_ID` — same one your frontend uses
- `ALLOWED_ORIGINS=https://example.com`

### 4. `Caddyfile` hostnames

Edit `deploy/Caddyfile` in the repo and replace `example.com` /
`api.example.com` with your real domains. Commit the change so the
next deploy picks it up.

### 5. GitHub secrets

In the repo: Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `VPS_HOST` | `1.2.3.4` or `vps.example.com` |
| `VPS_USER` | the SSH user you created |
| `VPS_SSH_KEY` | the private key matching `~/.ssh/authorized_keys` on the VPS |
| `VPS_PATH` | `/opt/chessrepeat` |
| `API_HOSTNAME` | `api.example.com` (used by smoke test) |
| `VITE_API_URL` | `https://api.example.com` (baked into frontend at build) |
| `VITE_GOOGLE_CLIENT_ID` | same id as `GOOGLE_CLIENT_ID` |
| `GHCR_PULL_TOKEN` | a personal access token with `read:packages` scope (the VPS uses this to pull from GHCR; `GITHUB_TOKEN` itself isn't reusable from outside the runner) |

### 6. First boot

Push to `main` (or run the workflow manually). Watch GitHub Actions:
- `test` runs `go test`
- `build-and-push` builds + pushes both images
- `deploy` rsyncs the bundle, pulls images, brings the stack up

On the VPS, verify:

```sh
docker compose ps                  # all 4 services Up
docker compose logs caddy --tail 50  # cert provisioning lines
curl https://api.example.com/healthz   # (once you add /healthz)
```

The Postgres init runs the bundled `schema.sql` exactly once — when
the `pgdata` volume is empty. After that, schema changes need a
proper migration tool (see "Schema changes" in `backend/README.md`).

## Day-to-day

- **Deploy** = push to `main`. The workflow does the rest.
- **Roll back** = set `IMAGE_TAG=<sha>` in `/opt/chessrepeat/.env` on
  the VPS to a known-good commit, then `docker compose up -d`.
- **Logs** = `docker compose logs -f backend` (or any service).
- **Restart a service** = `docker compose restart backend`.
- **Update Caddy config** = edit `deploy/Caddyfile`, push; the next
  deploy bundles the change. Caddy picks up the new file on
  `docker compose up -d`.

## Things that aren't in this setup yet

- **Backups**: `pgdata` is a docker volume on a single VPS. Add
  `pg_dump` to a cron + offsite copy before you have data you care
  about.
- **`/healthz`**: the smoke-test step expects this endpoint; add a
  trivial handler that returns 200.
- **Migrations**: `schema.sql` only runs on first init. For schema
  changes after launch, swap to golang-migrate or atlas.
- **Monitoring**: no Prometheus / log shipping. Fine for early days,
  not for paying users.
