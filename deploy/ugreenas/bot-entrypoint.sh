#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  npm run db:deploy
fi

if [ "${DEPLOY_DISCORD_COMMANDS:-false}" = "true" ]; then
  npm run deploy:commands
fi

exec "$@"
