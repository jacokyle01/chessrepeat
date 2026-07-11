#!/bin/bash
# Dead-man's-switch ping for the daily Postgres backup (see the
# db-backup service in docker-compose.yml).
#
# tiredofit/db-backup runs this post-backup with positional args:
#   $1  = backup exit code
#   $11 = move/upload-to-S3 exit code
# We ping the healthcheck URL only when BOTH succeeded, so a failed dump
# OR a failed R2 upload leaves the check un-pinged and your monitor
# raises an alert. A silently-broken backup is the failure mode this
# guards against.
#
# No-op when BACKUP_HEALTHCHECK_URL is unset, so the stack runs cleanly
# before a monitor is wired up.
set -u

backup_exit="${1:-1}"
move_exit="${11:-0}"   # 0 when there was no separate upload step

url="${BACKUP_HEALTHCHECK_URL:-}"
[ -z "$url" ] && exit 0

if [ "$backup_exit" = "0" ] && [ "$move_exit" = "0" ]; then
  # Success ping.
  curl -fsS -m 10 --retry 3 "$url" >/dev/null 2>&1 || true
else
  # Signal failure to a Healthchecks.io-style /fail endpoint if the URL
  # supports it; harmless (404, ignored) otherwise.
  curl -fsS -m 10 "${url%/}/fail" >/dev/null 2>&1 || true
fi
exit 0
