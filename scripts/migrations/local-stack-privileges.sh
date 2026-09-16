#!/usr/bin/env bash
# File: scripts/migrations/local-stack-privileges.sh
#
# LOCAL-ONLY privilege bootstrap for the Supabase local stack (FIX-Task-43).
#
# ---------------------------------------------------------------------------
# WHAT PROBLEM THIS SOLVES
# ---------------------------------------------------------------------------
# The repo's bucket migrations create RLS policies directly on `storage.objects`
# (e.g. supabase/migrations/20241214000005_create_user_avatars_bucket.sql).
# `supabase db reset` / `supabase start` applies migrations as the `postgres`
# role, and that role cannot create policies on `storage.objects` in a
# CLI-built local database, so the run aborts with:
#
#     ERROR: must be owner of table objects (SQLSTATE 42501)
#     CREATE POLICY "Users can upload their own avatars" ON storage.objects ...
#
# The Postgres image already ships the fix for this and documents *why*: its
# /docker-entrypoint-initdb.d/migrations/20220609081115_grant-supabase-auth-admin-and-supabase-storage-admin-to-postgres.sql
# reads
#
#     "This is done so that the `postgres` role can manage auth tables triggers,
#      storage tables policies, etc. which unblocks the revocation of superuser
#      access."
#
# ...and its body is exactly the GRANT this script re-applies. The image only
# executes that file through its own `migrate.sh` (as `supabase_admin`) on a
# first-time `initdb`; the Supabase CLI's "Initialising schema" step does not, so
# a CLI-built local database is missing the membership.
#
# ---------------------------------------------------------------------------
# WHY IT IS A SCRIPT AND NOT `supabase/roles.sql`
# ---------------------------------------------------------------------------
# The CLI does apply supabase/roles.sql before migrations, but it runs that file
# as a NON-superuser, and these roles are reserved in the Supabase Postgres
# build. Putting this GRANT there fails with:
#
#     ERROR: "supabase_auth_admin" role memberships are reserved,
#            only superusers can grant them (SQLSTATE 42501)
#
# ...which aborts `supabase start` outright — worse than the bug. So the grant
# has to come from a superuser connection (`supabase_admin`), which is what this
# script uses.
#
# ---------------------------------------------------------------------------
# WHY NOT "just fail-soft the storage policies"
# ---------------------------------------------------------------------------
# Guarding `CREATE POLICY ... ON storage.objects` so the reset goes green would
# silently drop real security controls on the buckets. Fix the privilege gap
# instead. (Owner decision, FIX-Task-43.)
#
# ---------------------------------------------------------------------------
# SAFETY
# ---------------------------------------------------------------------------
# * Refuses to run against anything that is not a loopback host.
# * Never applied to staging or production — this is a local-stack file only.
# * Idempotent: `GRANT role TO role` is a no-op when the membership already exists.
# * Rolls nothing back: the only change is a role membership, and it is removed by
#   deleting the local DB volume (or `ALTER ROLE ...` revoking it) — no schema or
#   data is touched.
#
# ---------------------------------------------------------------------------
# USAGE
# ---------------------------------------------------------------------------
#   # stack already running (default: the CLI's local DB on 127.0.0.1:54322)
#   bash scripts/migrations/local-stack-privileges.sh
#
#   # check without changing anything
#   bash scripts/migrations/local-stack-privileges.sh --dry-run
#
#   # non-default loopback port / password
#   bash scripts/migrations/local-stack-privileges.sh --db-url "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres"
#
# Order of operations for a brand-new local stack:
#   1. npx supabase start          # bootstraps the stack; the first bucket
#                                  # migration will fail here on a fresh volume
#   2. bash scripts/migrations/local-stack-privileges.sh
#   3. npx supabase start          # (or `npx supabase db reset`) now completes
#
# NOTE: the membership lives in the database volume's cluster catalogue, so it
# survives `supabase db reset` / `supabase stop` and only has to be re-applied
# when the DB volume is deleted.

set -euo pipefail

DB_URL="postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --db-url)
      DB_URL="${2:-}"
      shift 2
      ;;
    --db-url=*)
      DB_URL="${1#--db-url=}"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      sed -n '2,80p' "$0"
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# --- safety gate: loopback only ---------------------------------------------
HOST_PART="${DB_URL#*://}"      # user:pass@host:port/db
HOST_PART="${HOST_PART#*@}"     # host:port/db
HOST_PART="${HOST_PART%%/*}"    # host:port
HOST_ONLY="${HOST_PART%%:*}"

case "$HOST_ONLY" in
  127.0.0.1|localhost|::1|"[::1]") ;;
  *)
    echo "REFUSING: '$HOST_ONLY' is not a loopback host." >&2
    echo "This script is for the LOCAL Supabase stack only. Never run it against staging/production." >&2
    exit 3
    ;;
esac

GRANT_SQL="grant supabase_auth_admin, supabase_storage_admin to postgres;"

echo "target      : $DB_URL"
echo "grant       : $GRANT_SQL"
echo "dry run     : $DRY_RUN"
echo

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH — install the Postgres client (e.g. brew install libpq) and retry." >&2
  exit 4
fi

echo "--- before ---"
psql "$DB_URL" -tAc \
  "select 'postgres is_member_of supabase_storage_admin=' || pg_has_role('postgres','supabase_storage_admin','MEMBER')::text;"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "(dry run — nothing changed)"
  exit 0
fi

echo "--- applying ---"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "$GRANT_SQL"

echo "--- after (must show true) ---"
psql "$DB_URL" -tAc \
  "select 'postgres is_member_of supabase_storage_admin=' || pg_has_role('postgres','supabase_storage_admin','MEMBER')::text;"

echo
echo "Done. Now re-run 'npx supabase start' (or 'npx supabase db reset') and it should"
echo "pass the storage.objects policy migrations."
