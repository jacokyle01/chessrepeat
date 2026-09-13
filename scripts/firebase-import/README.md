# Firebase user import

Migrates existing `users` rows into Firebase Auth. Run once before
switching the app over to Firebase sign-in; re-run right before cutover
to pick up anyone who signed up in between (it is idempotent).

Each user is imported with **uid = token_id** (their Google OAuth
subject), so the backend's primary key does not change and existing
sessions, chapters and collaborator rows keep working untouched.

## Steps

1. In the Firebase console, enable the **Google** and **Email/Password**
   sign-in providers. Under *Google*, use the project's existing OAuth
   client id (Project settings → Your apps, or supply the old
   `GOOGLE_CLIENT_ID`) so the consent screen looks the same to users.
2. Project settings → Service accounts → *Generate new private key*.
   Save the JSON somewhere outside the repo.
3. Get the users out of Postgres. In production the database only
   listens inside the compose network, so dump it on the server and
   copy the file down:

   ```sh
   # on the VPS
   docker compose exec -T postgres sh -c \
     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\copy (SELECT token_id, email, picture FROM users ORDER BY token_id) TO STDOUT WITH CSV HEADER"' \
     > users.csv
   # on your machine
   scp <vps>:users.csv .
   ```

4. From this directory:

   ```sh
   npm install
   node import.mjs --csv users.csv --dry-run           # inspect, writes nothing
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
     node import.mjs --csv users.csv
   ```

   If the database is reachable directly (local dev), `POSTGRES_URL=...`
   in place of `--csv` reads it live.

5. Enable **Storage** (Build → Storage → Get started) for profile
   picture uploads, then deploy the rules in `../../firebase/` (see its
   README). New projects need the Blaze plan to enable Storage; the
   no-cost quota still applies.
6. Deploy the backend with `FIREBASE_PROJECT_ID` set (replaces
   `GOOGLE_CLIENT_ID`), then the frontend with the `VITE_FIREBASE_*`
   values from `frontend/.env.example`.

The script never deletes anything in Firebase or Postgres. Rows whose
`token_id` is not a numeric Google subject are skipped, since those
were created after cutover and already exist in Firebase.
