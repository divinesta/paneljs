#!/bin/sh
set -e

echo "[paneljs] Pushing schema..."
pnpm exec prisma db push --skip-generate

echo "[paneljs] Seeding example data..."
pnpm exec tsx seed.ts

if [ -n "${PANELJS_ADMIN_EMAIL:-}" ] && [ -n "${PANELJS_ADMIN_PASSWORD:-}" ]; then
  echo "[paneljs] Ensuring superuser ${PANELJS_ADMIN_EMAIL}..."
  pnpm exec tsx ../../packages/prisma/src/cli.ts createsuperuser \
    --config ./paneljs.config.ts \
    --email "$PANELJS_ADMIN_EMAIL" \
    --password "$PANELJS_ADMIN_PASSWORD" || true
fi

echo "[paneljs] Starting example host..."
exec pnpm exec tsx index.ts
