# chessrepeat backend

Go server backed by Postgres.

## Prerequisites

- Go (matching `go.mod`)
- Postgres 14+ running locally (or reachable via `POSTGRES_URL`)

## Setup

1. Create the database and a user with access to it:

   ```sh
   createdb chessrepeat
   createuser chessrepeat --pwprompt
   psql -d chessrepeat -c "GRANT ALL ON SCHEMA public TO chessrepeat;"
   ```

2. Apply the schema:

   ```sh
   psql "postgres://chessrepeat:<password>@localhost:5432/chessrepeat?sslmode=disable" \
     -f schema.sql
   ```

3. Create `.env` in the backend directory:

   ```
   POSTGRES_URL=postgres://chessrepeat:<password>@localhost:5432/chessrepeat?sslmode=disable
   GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
   ALLOWED_ORIGINS=http://localhost:5173
   LISTEN_ADDR=:8080
   COOKIE_SECURE=false
   ```

   Only `GOOGLE_CLIENT_ID` is required — the rest have dev defaults.
   Set `COOKIE_SECURE=true` in any environment behind TLS so the
   session cookie carries the `Secure` flag and the `__Host-` prefix.

## Run

```sh
./build.sh && ./chessrepeat
```

## Schema changes

Edit `schema.sql` and re-apply against a fresh database. There's no
migration tool wired up yet — drop and recreate the DB for now.
