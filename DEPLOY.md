# Deployment

The frontend ships through **Cloudflare Pages**, the API through a
**VPS running docker compose**. They're independent — a frontend-only
change deploys via Cloudflare without touching the VPS, and vice versa.

## Architecture

```
                          ┌────────────────────────────────────┐
   user ──► Cloudflare ───► chessrepeat.com  (static SPA)      │
   browser    Pages       └────────────────────────────────────┘
              │
              │ fetch + WS to api.chessrepeat.com
              ▼
                          ┌────────────────────────────────────┐
   internet ─────► 443 ───► caddy   (TLS + reverse proxy)      │
                          │   └─ api.example.com → backend:8080│
                          ├────────────────────────────────────┤
                          │ backend  (Go binary, distroless)   │
                          │ postgres (pgdata volume)           │
                          └────────────────────────────────────┘
                            all on a single docker network
```

Because the SPA and API live on different origins, the session cookie
must work cross-site:
- Use sibling subdomains (`chessrepeat.com` and `api.chessrepeat.com`)
  so they share the same registrable domain. SameSite=Lax is enough.
- If you put them on unrelated domains, the cookie needs
  SameSite=None+Secure and you'll have a CSRF surface to harden.

## Frontend (Cloudflare Pages)

In the Cloudflare dashboard → Pages → Create project → connect this
GitHub repo. Settings:

| Field | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |
| Node version | `23` (set as env var `NODE_VERSION=23`) |

Environment variables (Production + Preview):

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://api.example.com` |
| `VITE_GOOGLE_CLIENT_ID` | the same Google OAuth client id the backend uses |

Custom domain: add `example.com` (or whatever you own) and let
Cloudflare point DNS at the Pages project.

PR previews: Cloudflare auto-builds every PR to a unique URL. Add
those preview origins to `ALLOWED_ORIGINS` on the backend if you want
them to be able to call the API (or accept that previews are
read-only against a separate staging API).

## Backend (VPS + docker compose)

CI pipeline (on push to `main`):
1. `test-on-vps` — `go vet` + `go test -race ./...` running on a
   self-hosted GitHub Actions runner installed on the VPS itself
2. `build-and-push` — runs on GitHub-hosted infra, builds the
   `chessrepeat-backend` image, pushes to GHCR with both `:latest`
   and `:<sha>` tags
3. `deploy` — runs on the same self-hosted VPS runner: copies the
   compose files into the deploy dir, `docker compose pull && up -d`,
   then curls `/healthz` as a smoke test

PRs run a lightweight `test-pr` job on a GitHub-hosted runner so
merging doesn't depend on the VPS being up.

### One-time VPS setup

#### 1. DNS

Point `api.example.com` (A record) at the VPS public IP. Caddy will
fail to provision a cert if it doesn't resolve when the stack boots.

#### 2. VPS prep

On the VPS (Ubuntu 22.04+):

```sh
# install docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # log out and back in

# create the deploy directory
sudo mkdir -p /opt/chessrepeat
sudo chown $USER:$USER /opt/chessrepeat
```

#### 3. `.env` on the VPS

After the first deploy lands the bundle (or by hand from your local
copy):

```sh
cd /opt/chessrepeat
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

Fill in:
- `GH_OWNER` — your GitHub username/org
- `POSTGRES_PASSWORD` — set a real password
- `GOOGLE_CLIENT_ID` — same one Cloudflare Pages uses
- `ALLOWED_ORIGINS=https://example.com` (the Cloudflare-hosted origin)

#### 4. `Caddyfile` hostname

Edit `Caddyfile` in the repo root and replace `api.example.com` with
your real API hostname. Commit so the next deploy bundles it.

#### 5. Self-hosted runner on the VPS

The pipeline relies on a runner installed on the VPS so test + deploy
jobs execute there. Install it once:

```sh
# On the VPS, as the deploy user:
mkdir -p ~/actions-runner && cd ~/actions-runner

# Get the latest installer URL + token from
#   GitHub → repo → Settings → Actions → Runners → New self-hosted runner
# (the page shows the exact tar.gz URL and the registration token).

curl -O -L https://github.com/actions/runner/releases/download/<version>/actions-runner-linux-x64-<version>.tar.gz
tar xzf ./actions-runner-linux-x64-<version>.tar.gz

# Register: when prompted for labels, add `chessrepeat-vps` so the
# workflow's `runs-on: [self-hosted, chessrepeat-vps]` matches it.
./config.sh --url https://github.com/<owner>/<repo> --token <token> \
            --labels chessrepeat-vps

# Install as a systemd service so it survives reboots:
sudo ./svc.sh install
sudo ./svc.sh start
```

The runner user must be able to:
- write to `/opt/chessrepeat` (set during step 2 above)
- run `docker compose` (member of the `docker` group)
- reach the public internet on 443 (for the smoke-test curl)

`actions/setup-go@v5` will fetch its own Go toolchain on first run; no
Go install is needed on the VPS.

#### 6. GitHub secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_PATH` | `/opt/chessrepeat` |
| `API_HOSTNAME` | `api.chessrepeat.com` (used by the smoke test curl) |
| `GHCR_PULL_TOKEN` | personal access token with `read:packages`; the VPS uses this to pull from GHCR (the runner's `GITHUB_TOKEN` isn't reusable from outside the build job) |

No SSH credentials are needed — the runner is already on the VPS.
Frontend-side `VITE_*` secrets do **not** go here; they live in
Cloudflare Pages.

> **Self-hosted runner caveat.** Runners on public repos can be
> abused by malicious PRs. This repo is private and only the `deploy`
> job uses the self-hosted runner on `push` to `main` (where you
> control what lands), so the exposure is bounded — but if you ever
> open the repo, restrict the runner to specific workflows under
> Settings → Actions → Runners.

#### 7. First boot

Push to `main`. Watch GitHub Actions:
- `test-on-vps` runs `go test` on the VPS
- `build-and-push` builds + pushes the backend image to GHCR
- `deploy` (on the VPS runner) pulls the new image and brings the
  stack up

On the VPS:

```sh
docker compose ps                    # postgres, backend, caddy all Up
docker compose logs caddy --tail 50  # cert provisioning lines
curl https://api.example.com/healthz # (once you add /healthz)
```

The Postgres init runs the bundled `schema.sql` exactly once — when
the `pgdata` volume is empty. Subsequent schema changes need a real
migration tool.

## Day-to-day

- **Backend deploy** = push to `main`. Workflow does the rest.
- **Frontend deploy** = push to `main`. Cloudflare Pages does the rest.
- **Roll back backend** = set `IMAGE_TAG=<sha>` in `/opt/chessrepeat/.env`,
  then `docker compose up -d`.
- **Roll back frontend** = in Cloudflare Pages, click any past
  deployment and "Rollback".
- **Logs** = `docker compose logs -f backend` on the VPS;
  Cloudflare Pages → Deployments → log for the frontend build.
- **Update Caddy config** = edit `Caddyfile` at the repo root, push;
  next deploy bundles it.

## Backups

Daily logical backups run as the `db-backup` sidecar in the compose
stack (`tiredofit/db-backup`): once every 24h it `pg_dump`s the DB,
GPG-encrypts the dump (it holds user emails), and uploads it to
**Cloudflare R2**. Retention is 7 days (`DB01_CLEANUP_TIME`). Because
it's part of the compose file, it ships and redeploys with everything
else — no host cron, no state outside `.env`.

### One-time R2 setup

1. Cloudflare dashboard → **R2** → create a bucket, e.g.
   `chessrepeat-backups`.
2. R2 → **Manage API Tokens** → create a token scoped to that bucket
   with **Object Read & Write**. Note the Access Key ID, Secret Access
   Key, and the account endpoint host (`<accountid>.r2.cloudflarestorage.com`).
3. On the VPS, fill the backup block in `/opt/chessrepeat/.env`
   (see `.env.example`): `R2_BUCKET`, `R2_ENDPOINT`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_ENCRYPT_PASSPHRASE`.
4. **Store `BACKUP_ENCRYPT_PASSPHRASE` in a password manager too** — if
   the VPS is lost and the passphrase lived only in its `.env`, the
   offsite backups can't be decrypted.
5. (Optional) create a check at healthchecks.io expecting a daily ping
   and put its URL in `BACKUP_HEALTHCHECK_URL` so a silently-failing
   backup alerts you.
6. `docker compose up -d db-backup` (or let the next deploy do it).
   Force an immediate run to verify: `docker compose exec db-backup backup-now`,
   then check `docker compose logs db-backup` and confirm an object
   landed in the R2 bucket.
7. (Recommended) add an R2 **lifecycle rule** to expire objects older
   than ~30 days as a backstop to the container-side retention.

### Restore

```sh
# 1. Pull the desired dump from R2 (rclone/aws-cli/dashboard), e.g. into ./restore/
# 2. Decrypt (GPG symmetric, same passphrase):
gpg --batch --passphrase "$BACKUP_ENCRYPT_PASSPHRASE" \
    --decrypt chessrepeat_<timestamp>.sql.gz.gpg > dump.sql.gz
gunzip dump.sql.gz
# 3. Restore into a running Postgres (test against a throwaway DB first):
docker compose exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < dump.sql
```

> **Test your restore.** A backup you've never restored isn't a backup.
> Do one full decrypt + restore into a throwaway database now, and
> repeat periodically. Adjust the decrypt/extension steps to match the
> image's actual output format (`docker compose logs db-backup` shows
> the filename it wrote).

## Things that aren't in this setup yet

- **`/healthz`**: the smoke-test step expects this endpoint; add a
  trivial handler returning 200.
- **Migrations**: `schema.sql` only runs on first init. For schema
  changes after launch, switch to golang-migrate or atlas.
- **Monitoring**: no Prometheus / log shipping yet.
