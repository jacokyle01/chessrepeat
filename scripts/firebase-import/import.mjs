// One-shot migration: copy every row of the `users` table into Firebase
// Auth so existing Google accounts keep working after the switch from
// raw Google OAuth to Firebase.
//
// The trick that makes this a no-op for the database: each user is
// imported with uid = token_id (their Google OAuth subject) and a
// google.com provider record carrying the same subject. When they next
// sign in with Google through Firebase, Firebase matches on that
// provider subject and lands them on this account, so the ID token's
// `sub` equals the token_id the backend already keys everything on.
//
// Idempotent: re-running updates existing Firebase users in place
// (uid conflicts are treated as "already imported"). Safe to run
// several times — once ahead of cutover and once right before.
//
// Usage — read straight from Postgres:
//   npm install
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//   POSTGRES_URL=postgres://... \
//   node import.mjs [--dry-run]
//
// or from a CSV dump (token_id,email,picture with a header row), which
// is handier when the database isn't reachable from your machine:
//   node import.mjs --csv users.csv [--dry-run]

import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvIdx = args.indexOf('--csv');
const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null;
const BATCH = 1000; // importUsers hard limit per call

const { POSTGRES_URL, GOOGLE_APPLICATION_CREDENTIALS } = process.env;
if (!csvPath && !POSTGRES_URL) die('set POSTGRES_URL or pass --csv <file>');
if (!GOOGLE_APPLICATION_CREDENTIALS && !dryRun) {
  die('GOOGLE_APPLICATION_CREDENTIALS must point at a service-account JSON for the Firebase project');
}

const rows = csvPath ? readCsv(csvPath) : await readPostgres(POSTGRES_URL);
console.log(`read ${rows.length} users from ${csvPath ? csvPath : 'postgres'}`);

const records = rows
  .filter((r) => {
    // Every pre-Firebase row was created from a Google ID token, so
    // token_id is a Google subject (a string of digits). Anything else
    // was created after cutover and already lives in Firebase.
    if (!/^\d+$/.test(r.token_id)) {
      console.log(`skip ${r.token_id}: not a Google subject (already a Firebase uid?)`);
      return false;
    }
    if (!r.email) {
      console.log(`skip ${r.token_id}: no email`);
      return false;
    }
    return true;
  })
  .map((r) => ({
    uid: r.token_id,
    email: r.email,
    // Google verified this address when it issued the original token.
    emailVerified: true,
    photoURL: r.picture || undefined,
    providerData: [
      {
        providerId: 'google.com',
        uid: r.token_id,
        email: r.email,
        photoURL: r.picture || undefined,
      },
    ],
  }));

console.log(`${records.length} users to import${dryRun ? ' (dry run — nothing written)' : ''}`);
if (dryRun) {
  for (const r of records.slice(0, 5)) console.log(JSON.stringify(r));
  if (records.length > 5) console.log(`… and ${records.length - 5} more`);
  process.exit(0);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

let ok = 0;
let failed = 0;
for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const result = await auth.importUsers(batch);
  ok += result.successCount;
  for (const e of result.errors) {
    const rec = batch[e.index];
    // uid-already-exists means a previous run got this one; that's the
    // idempotent path, not a failure.
    if (e.error.code === 'auth/uid-already-exists') {
      ok += 1;
      continue;
    }
    failed += 1;
    console.error(`failed ${rec.uid} (${rec.email}): ${e.error.code} ${e.error.message}`);
  }
  console.log(`batch ${i / BATCH + 1}: ${result.successCount} imported, ${result.failureCount} errors`);
}
console.log(`done: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);

function die(msg) {
  console.error(msg);
  process.exit(2);
}

async function readPostgres(url) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT token_id, email, picture FROM users ORDER BY token_id`);
    return rows;
  } finally {
    await client.end();
  }
}

// Minimal RFC 4180 reader: handles quoted fields, doubled quotes and
// newlines inside quotes. Output of `psql \copy ... CSV HEADER`.
function readCsv(path) {
  const text = readFileSync(path, 'utf8');
  const records = [];
  let field = '';
  let record = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      field = '';
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }
  if (!records.length) return [];
  const header = records[0].map((h) => h.trim());
  for (const col of ['token_id', 'email', 'picture']) {
    if (!header.includes(col)) die(`csv is missing a "${col}" column (got: ${header.join(', ')})`);
  }
  return records
    .slice(1)
    .filter((r) => r.length > 1 || r[0] !== '')
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
