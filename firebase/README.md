# Firebase project config

Deployable Firebase config that isn't managed from the console.

- `storage.rules` — Cloud Storage security rules for profile pictures.

## Deploy

```sh
npm i -g firebase-tools   # once
cd firebase
firebase login
firebase use <project-id>   # writes .firebaserc (gitignored); repeat per project (dev / prod)
firebase deploy --only storage
```

Or paste `storage.rules` into Console → Storage → Rules.

## Free-tier note

Cloud Storage's no-cost quota is 5 GB stored, 1 GB/day downloaded and
20 000 uploads/day. The client resizes every avatar to a ~15 KB JPEG
and the rules refuse anything over 256 KB, so a realistic user base
stays far inside it. If the quota is exhausted anyway, uploads fail
with `storage/quota-exceeded`; the signup form reports that and lets
the user continue without a picture rather than blocking signup.

On the Blaze plan there is no hard cap — usage beyond the free quota
is billed. To enforce a ceiling, set a Cloud Billing budget alert on
the project.
