#!/usr/bin/env bash
# READ-ONLY Contabo production gate script.
# Run as deploy@vmi3457792 from /opt/greyhoundiq after SSH is restored.
# NEVER: drop DB, recreate volumes, pg_restore over live data, or docker volume rm.
set -euo pipefail

cd /opt/greyhoundiq
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="${READONLY_GATE_OUT:-$HOME/giq-readonly-gate-$ts}"
mkdir -p "$out_dir"
echo "Writing evidence to $out_dir"

{
  echo "=== A/B host baseline ==="
  hostname
  uname -a
  . /etc/os-release
  echo "PRETTY_NAME=$PRETTY_NAME"
  date -u
  timedatectl || true
  nproc
  free -h
  df -hT /
  swapon --show || true
  docker version --format 'Engine={{.Server.Version}}' || true
  docker compose version || true
} | tee "$out_dir/host.txt"

{
  echo "=== containers ==="
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo "=== privileged / readonly ==="
  docker ps -q | while read -r id; do
    docker inspect --format '{{.Name}} Privileged={{.HostConfig.Privileged}} ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}} User={{.Config.User}}' "$id"
  done
  echo "=== compose config resolve (no start) ==="
  docker compose config --images || true
} | tee "$out_dir/docker.txt"

{
  echo "=== ufw ==="
  sudo ufw status verbose || true
  echo "=== listening (host) ==="
  sudo ss -lntup | egrep ':(22|80|443|5432|7880|7881)\b' || true
} | tee "$out_dir/network.txt"

app_db='giq_production_stage11_20260718_r2'
rt_db='giq_realtime_stage11'

{
  echo "=== databases present ==="
  docker compose exec -T postgres psql -X -U postgres -d postgres -Atc \
    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1;"
  echo "=== sizes ==="
  docker compose exec -T postgres psql -X -U postgres -d postgres -c \
    "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname IN ('$app_db','$rt_db') ORDER BY 1;"
  echo "=== key counts (app) ==="
  docker compose exec -T postgres psql -X -U postgres -d "$app_db" -v ON_ERROR_STOP=1 -c "
SELECT 'Runner' AS entity, count(*)::bigint AS n FROM public.\"Runner\"
UNION ALL SELECT 'Result', count(*)::bigint FROM public.\"Result\"
UNION ALL SELECT 'Race', count(*)::bigint FROM public.\"Race\"
UNION ALL SELECT 'Dog', count(*)::bigint FROM public.\"Dog\"
UNION ALL SELECT 'RaceVideo', count(*)::bigint FROM public.\"RaceVideo\"
ORDER BY 1;"
  echo "=== app shape ==="
  docker compose exec -T postgres psql -X -U postgres -d "$app_db" -At -F '|' -c "
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast'),
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='m' AND n.nspname NOT IN ('pg_catalog','information_schema')),
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND c.relforcerowsecurity AND n.nspname NOT IN ('pg_catalog','information_schema'));"
  echo "=== pg settings sample ==="
  docker compose exec -T postgres psql -X -U postgres -d "$app_db" -c "
SHOW max_connections;
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW maintenance_work_mem;
SHOW work_mem;
SHOW max_wal_size;
SHOW checkpoint_timeout;
SHOW wal_compression;
SHOW password_encryption;"
  echo "=== recovery write activity? (expect idle) ==="
  docker compose exec -T postgres psql -X -U postgres -d postgres -c "
SELECT pid, usename, state, wait_event_type, wait_event, left(query,120) AS query
FROM pg_stat_activity
WHERE datname IS NOT NULL
ORDER BY state, pid;"
} | tee "$out_dir/database.txt"

echo "READ-ONLY GATE COMPLETE. Review $out_dir before any service mutation or backup."
echo "Expected PITR freeze (not necessarily current live): Runner=5298108 Result=4664787"
echo "Do NOT start/stop services from this script."
