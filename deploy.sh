#!/bin/sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не установлен"
  exit 1
fi

if [ ! -f .env.docker ]; then
  cp .env.docker.example .env.docker
  echo "Создан .env.docker — проверьте пароли перед запуском"
fi

case "${1:-up}" in
  up)
    docker compose --env-file .env.docker up -d --build
    echo ""
    echo "API: https://api.bit-system.uz (nginx -> 127.0.0.1:3000)"
    echo "Super admin: superadmin@school.local / superadmin123"
    ;;
  down)
    docker compose --env-file .env.docker down
    ;;
  seed)
    docker compose --env-file .env.docker --profile seed run --rm seed
    ;;
  logs)
    docker compose --env-file .env.docker logs -f api
    ;;
  *)
    echo "Использование: ./deploy.sh [up|down|seed|logs]"
    exit 1
    ;;
esac
