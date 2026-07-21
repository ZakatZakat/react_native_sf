#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Единый деплой CitySignal (react_native_sf) на прод. Инвариант: НА ПРОДЕ ВСЕГДА
# РОВНО ОДИН git-коммит из origin/master. Никаких ручных scp/rsync/docker build
# на боксе — именно из-за них дерево обрастало незакоммиченным WIP разных сессий
# (Франкенштейн-сборки) и терялась работа.
#
# Что делает (сериализованно, под серверным локом):
#   1. Запрещает деплой грязного локального дерева и коммита, которого нет в
#      origin/master.
#   2. Берёт серверный ЛОК (atomic mkdir) — две сессии не катят одновременно.
#   3. Защищает бокс: если там изменены ОТСЛЕЖИВАЕМЫЕ файлы (чей-то серверный
#      WIP) — abort (reset --hard их бы откатил), пока не --force.
#   4. На боксе: git fetch + reset --hard <sha> (untracked-файлы и .env целы),
#      затем docker compose build/up нужного сервиса.
#   5. Снимает лок (даже при ошибке) и сверяет, что бокс на нужном коммите.
#
# Использование:
#   ./scripts/deploy.sh                      # катит origin/master, сервис app
#   ./scripts/deploy.sh --service curator    # бэкенд вместо фронта
#   ./scripts/deploy.sh --service "app curator"
#   ./scripts/deploy.sh <ref|sha>            # конкретный коммит (должен быть в master)
#   ./scripts/deploy.sh --check              # чей коммит сейчас на проде
#   ./scripts/deploy.sh --force              # катить, даже если на боксе есть правки
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@45.144.52.40}"
DIR="${DEPLOY_DIR:-/root/react_native_sf}"
SSH="ssh -o ConnectTimeout=15"
SERVICES="app"
TARGET="origin/master"
FORCE=0
# Прод собирается/поднимается с docker-compose.local.yml (там app/telegram/api/
# curator/db). Дефолтный docker-compose.yml — легаси-топология без curator, им
# собирать нельзя. Переопределяемо через DEPLOY_COMPOSE_FILE.
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.local.yml}"

while [ $# -gt 0 ]; do
  case "$1" in
    --service) SERVICES="$2"; shift 2 ;;
    --force)   FORCE=1; shift ;;
    --check)
      echo "Прод сейчас на коммите:"
      $SSH "$SERVER" "cd '$DIR' && git log -1 --format='  %h  %s  (%ci)'" 2>/dev/null \
        || echo "  (не смог прочитать git на боксе)"
      exit 0 ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) TARGET="$1"; shift ;;
  esac
done

red(){ printf '\033[31m%s\033[0m\n' "$1"; }
grn(){ printf '\033[32m%s\033[0m\n' "$1"; }

# 1. локально — только чистое дерево этой сессии
git update-index -q --refresh || true
if ! git diff-index --quiet HEAD --; then
  red "✗ Незакоммиченные изменения в рабочем дереве."
  red "  Закоммить СВОИ файлы (git add <свои пути>), влей в master, потом деплой."
  exit 1
fi

# 2. цель обязана быть уже в origin/master (единственный источник правды)
git fetch -q origin master
SHA="$(git rev-parse --verify "${TARGET}^{commit}" 2>/dev/null || true)"
[ -n "$SHA" ] || { red "✗ Не нашёл коммит '$TARGET'."; exit 1; }
if ! git merge-base --is-ancestor "$SHA" origin/master; then
  red "✗ Коммит $SHA не влит в origin/master. На прод попадает ТОЛЬКО master:"
  red "    git checkout master && git merge --no-ff <ветка> && git push origin master"
  red "  затем снова ./scripts/deploy.sh"
  exit 1
fi
SHORT="$(git rev-parse --short "$SHA")"
WHO="$(git config user.name 2>/dev/null || echo agent)"

# 3. серверный лок (atomic mkdir). Снимаем при любом выходе.
if ! $SSH "$SERVER" "mkdir '$DIR/.deploylock' 2>/dev/null"; then
  red "✗ Деплой уже идёт другой сессией:"
  $SSH "$SERVER" "cat '$DIR/.deploylock/info' 2>/dev/null" || true
  red "  Если завис — сними лок: ssh $SERVER 'rm -rf $DIR/.deploylock'"
  exit 1
fi
$SSH "$SERVER" "echo '$WHO  $SHORT  $(date -u +%FT%TZ)' > '$DIR/.deploylock/info'"
release(){ $SSH "$SERVER" "rm -rf '$DIR/.deploylock'" >/dev/null 2>&1 || true; }
trap release EXIT

# 4. защита бокса от потери серверных правок при reset --hard
$SSH "$SERVER" "cd '$DIR' && git fetch -q origin" 2>/dev/null || true
# 4a. незакоммиченные изменения отслеживаемых файлов
DIRTY="$($SSH "$SERVER" "cd '$DIR' && git status --porcelain --untracked-files=no" 2>/dev/null || true)"
if [ -n "$DIRTY" ] && [ "$FORCE" -ne 1 ]; then
  red "✗ На боксе изменены ОТСЛЕЖИВАЕМЫЕ файлы — reset --hard их откатит:"
  printf '%s\n' "$DIRTY" | sed 's/^/    /'
  red "  Разберись (влей их в master или сбрось на боксе), либо --force чтобы всё равно откатить к master."
  red "  (untracked-файлы и .env reset --hard НЕ трогает — они переживут деплой.)"
  exit 1
fi
# 4b. коммиты на боксе, которых НЕТ в origin/master (reset --hard их СНЕСЁТ)
if [ "$FORCE" -ne 1 ] && ! $SSH "$SERVER" "cd '$DIR' && git merge-base --is-ancestor HEAD origin/master" 2>/dev/null; then
  red "✗ На боксе есть коммиты, которых нет в origin/master — reset --hard их потеряет:"
  $SSH "$SERVER" "cd '$DIR' && git log origin/master..HEAD --oneline" 2>/dev/null | sed 's/^/    /'
  red "  Запушь их в master (там источник правды), потом деплой. Либо --force, чтобы"
  red "  всё равно сбросить бокс к origin/master (серверные коммиты будут потеряны)."
  exit 1
fi

grn "→ Деплою $SHORT (из master), сервис(ы)=$SERVICES, compose=$COMPOSE_FILE, как $WHO"

# 5. бокс → целевой коммит (untracked + .env целы)
$SSH "$SERVER" "cd '$DIR' && git fetch -q origin && git reset --hard '$SHA' && git log -1 --format='  бокс теперь на %h  %s'"

# 6. пересборка + рестарт сервисов
$SSH "$SERVER" "cd '$DIR' && docker compose -f '$COMPOSE_FILE' build $SERVICES && docker compose -f '$COMPOSE_FILE' up -d $SERVICES" 2>&1 | tail -8

# 7. проверка
BOX_SHA="$($SSH "$SERVER" "cd '$DIR' && git rev-parse --short HEAD" 2>/dev/null || true)"
if [ "$BOX_SHA" = "$SHORT" ]; then grn "✓ Готово. На проде $BOX_SHA."; else red "⚠ Бокс на $BOX_SHA, ожидался $SHORT."; fi
$SSH "$SERVER" "docker ps --filter name=react_native_sf --format '  {{.Names}}  {{.Status}}'" 2>/dev/null || true
