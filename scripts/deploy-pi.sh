#!/usr/bin/env bash
set -euo pipefail

PI_USER="${ZIPLIST_PI_USER:-pibulus}"
PI_HOST="${ZIPLIST_PI_HOST:-pibulus.local}"
APP_NAME="${ZIPLIST_PI_APP_NAME:-ziplist}"
APP_DIR="${ZIPLIST_PI_APP_DIR:-/home/pibulus/apps/ziplist}"
BACKUP_DIR="${ZIPLIST_PI_BACKUP_DIR:-/home/pibulus/apps-backups}"
STAGING_ROOT="${ZIPLIST_PI_STAGING_ROOT:-/home/pibulus/apps-staging}"
SERVICE="${ZIPLIST_PI_SERVICE:-ziplist}"
SMOKE_HOST="${ZIPLIST_PI_SMOKE_HOST:-127.0.0.1}"
SMOKE_PORT="${ZIPLIST_PI_SMOKE_PORT:-19003}"
LIVE_URL="${ZIPLIST_PI_LIVE_URL:-http://127.0.0.1:9003/}"
REMOTE="${PI_USER}@${PI_HOST}"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGING_DIR="${STAGING_ROOT}/${APP_NAME}-${STAMP}"
BACKUP_PATH="${BACKUP_DIR}/${APP_NAME}-${STAMP}"
PREVIOUS_DIR="${APP_DIR}.previous-${STAMP}"

ssh_cmd=(ssh -o StrictHostKeyChecking=accept-new)
rsync_rsh="ssh -o StrictHostKeyChecking=accept-new"

if [[ -n "${SSHPASS:-}" ]]; then
  ssh_cmd=(sshpass -e ssh -o StrictHostKeyChecking=accept-new)
  rsync_rsh="sshpass -e ssh -o StrictHostKeyChecking=accept-new"
fi

remote_bash() {
  "${ssh_cmd[@]}" "$REMOTE" bash -s -- "$@"
}

npm run build

remote_bash "$STAGING_DIR" "$BACKUP_DIR" <<'REMOTE'
set -euo pipefail

staging_dir="$1"
backup_dir="$2"

rm -rf "$staging_dir"
mkdir -p "$staging_dir" "$backup_dir"
printf 'staging=%s\n' "$staging_dir"
REMOTE

rsync -az --delete \
  --exclude node_modules \
  --exclude package.json \
  --exclude package-lock.json \
  -e "$rsync_rsh" \
  build/ "$REMOTE:$STAGING_DIR/"

rsync -az -e "$rsync_rsh" package.json package-lock.json "$REMOTE:$STAGING_DIR/"

remote_bash "$APP_DIR" "$STAGING_DIR" <<'REMOTE'
set -euo pipefail

app_dir="$1"
staging_dir="$2"

if [[ -d "$app_dir" ]]; then
  while IFS= read -r env_file; do
    cp -p "$env_file" "$staging_dir/"
  done < <(find "$app_dir" -maxdepth 1 -type f \( -name ".env" -o -name ".env.*" \) -print)
fi
REMOTE

remote_bash "$STAGING_DIR" "$SMOKE_HOST" "$SMOKE_PORT" <<'REMOTE'
set -euo pipefail

staging_dir="$1"
smoke_host="$2"
smoke_port="$3"
smoke_log="$staging_dir/.smoke.log"
zero_file=""

cd "$staging_dir"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund

test -s "$staging_dir/index.js"
zero_file="$(find "$staging_dir/client" "$staging_dir/server" -type f -size 0 -print -quit)"
if [[ -n "$zero_file" ]]; then
  printf 'zero-byte build file: %s\n' "$zero_file" >&2
  exit 1
fi

PORT="$smoke_port" \
HOST="$smoke_host" \
ORIGIN="http://${smoke_host}:${smoke_port}" \
  node index.js >"$smoke_log" 2>&1 &
smoke_pid=$!

cleanup_smoke() {
  kill "$smoke_pid" >/dev/null 2>&1 || true
  wait "$smoke_pid" >/dev/null 2>&1 || true
}
trap cleanup_smoke EXIT

smoke_ok=0
for _ in $(seq 1 30); do
  if curl -fsS "http://${smoke_host}:${smoke_port}/" >/dev/null; then
    smoke_ok=1
    break
  fi

  if ! kill -0 "$smoke_pid" >/dev/null 2>&1; then
    cat "$smoke_log" >&2
    exit 1
  fi

  sleep 1
done

if [[ "$smoke_ok" != "1" ]]; then
  cat "$smoke_log" >&2
  printf 'smoke test timed out on port %s\n' "$smoke_port" >&2
  exit 1
fi

cleanup_smoke
trap - EXIT
printf 'smoke=ok\n'
REMOTE

remote_bash \
  "$APP_DIR" \
  "$STAGING_DIR" \
  "$BACKUP_PATH" \
  "$PREVIOUS_DIR" \
  "$SERVICE" \
  "$LIVE_URL" <<'REMOTE'
set -euo pipefail

app_dir="$1"
staging_dir="$2"
backup_path="$3"
previous_dir="$4"
service="$5"
live_url="$6"

require_safe_path() {
  case "${1:-}" in
    "" | "/" | "/home" | "/home/pibulus" | "/home/pibulus/apps")
      printf 'unsafe deploy path: %s\n' "$1" >&2
      exit 1
      ;;
  esac
}

rollback() {
  status=$?
  if [[ "$status" -ne 0 && -d "$previous_dir" ]]; then
    printf 'deploy failed; rolling back to previous app dir\n' >&2
    rm -rf "$app_dir"
    mv "$previous_dir" "$app_dir"
    sudo -n systemctl restart "$service" || true
  fi
  exit "$status"
}
trap rollback EXIT

require_safe_path "$app_dir"
require_safe_path "$staging_dir"
require_safe_path "$backup_path"
require_safe_path "$previous_dir"

test -d "$staging_dir"
test -s "$staging_dir/index.js"

rm -rf "$previous_dir"
mkdir -p "$backup_path"

if [[ -e "$app_dir" || -L "$app_dir" ]]; then
  rsync -a --delete "$app_dir/" "$backup_path/"
  mv "$app_dir" "$previous_dir"
fi

mv "$staging_dir" "$app_dir"
sudo -n systemctl restart "$service"
systemctl is-active "$service"

live_ok=0
for _ in $(seq 1 20); do
  if curl -fsS "$live_url" >/dev/null; then
    live_ok=1
    break
  fi
  sleep 1
done

if [[ "$live_ok" != "1" ]]; then
  printf 'live smoke test failed: %s\n' "$live_url" >&2
  exit 1
fi

rm -rf "$previous_dir"
trap - EXIT
printf 'backup=%s\n' "$backup_path"
printf 'deployed=%s\n' "$app_dir"
REMOTE
