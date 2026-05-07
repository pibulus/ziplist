#!/usr/bin/env bash
set -euo pipefail

PI_USER="${ZIPLIST_PI_USER:-pibulus}"
PI_HOST="${ZIPLIST_PI_HOST:-pibulus.local}"
APP_DIR="${ZIPLIST_PI_APP_DIR:-/home/pibulus/apps/ziplist}"
BACKUP_DIR="${ZIPLIST_PI_BACKUP_DIR:-/home/pibulus/apps-backups}"
SERVICE="${ZIPLIST_PI_SERVICE:-ziplist}"
REMOTE="${PI_USER}@${PI_HOST}"

ssh_cmd=(ssh -o StrictHostKeyChecking=accept-new)
rsync_rsh="ssh -o StrictHostKeyChecking=accept-new"

if [[ -n "${SSHPASS:-}" ]]; then
  ssh_cmd=(sshpass -e ssh -o StrictHostKeyChecking=accept-new)
  rsync_rsh="sshpass -e ssh -o StrictHostKeyChecking=accept-new"
fi

npm run build

"${ssh_cmd[@]}" "$REMOTE" \
  "set -eu; stamp=\$(date +%Y%m%d-%H%M%S); backup='${BACKUP_DIR}/ziplist-'\$stamp; mkdir -p \"\$backup\"; rsync -a --delete '${APP_DIR}/' \"\$backup/\"; printf 'backup=%s\n' \"\$backup\""

rsync -az --delete \
  --exclude node_modules \
  --exclude package.json \
  --exclude package-lock.json \
  -e "$rsync_rsh" \
  build/ "$REMOTE:$APP_DIR/"

rsync -az -e "$rsync_rsh" package.json package-lock.json "$REMOTE:$APP_DIR/"

"${ssh_cmd[@]}" "$REMOTE" \
  "set -eu; cd '$APP_DIR'; npm ci --omit=dev --ignore-scripts --no-audit --no-fund; sudo -n systemctl restart '$SERVICE'; systemctl is-active '$SERVICE'"
