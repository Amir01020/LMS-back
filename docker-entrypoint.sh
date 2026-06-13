#!/bin/sh
set -e

echo "Ожидание PostgreSQL (${DB_HOST}:${DB_PORT:-5432})..."

until node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
client.connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
" >/dev/null 2>&1; do
  sleep 2
done

echo "PostgreSQL доступен"

if [ "$AUTO_SEED" = "true" ]; then
  echo "Загрузка начальных данных (AUTO_SEED=true)..."
  node scripts/seedSuperAdmin.js
  if [ "$SEED_DEMO_DATA" = "true" ]; then
    node scripts/seedTestData.js
  fi
fi

exec "$@"
