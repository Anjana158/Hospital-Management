#!/usr/bin/env bash
# Sample the load-test API process and the load-test database.
# This script only reads. It does not start k6, drop a database, or write SQL data.
set -euo pipefail

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
    echo "TEST_DATABASE_URL is required" >&2
    exit 1
fi

eval "$(python3 - <<'PY'
import os
import shlex
from urllib.parse import urlparse

raw = os.environ["TEST_DATABASE_URL"]
parsed = urlparse(raw)
host = parsed.hostname or ""
database = (parsed.path or "/").lstrip("/").split("?")[0]
if parsed.scheme not in {"postgresql", "postgres"}:
    raise SystemExit("TEST_DATABASE_URL must use postgresql")
if host not in {"127.0.0.1", "localhost"}:
    raise SystemExit(f"Refusing database host {host}")
if database != "hospital_management_loadtest":
    raise SystemExit(f"Refusing database {database}")
port = parsed.port or 5432
user = parsed.username or ""
password = parsed.password or ""
base = os.environ.get("BASE_URL", "http://127.0.0.1:5001")
if not (base.startswith("http://127.0.0.1:") or base.startswith("http://localhost:")):
    raise SystemExit("BASE_URL must be a loopback http origin")
if base.rsplit(":", 1)[-1].rstrip("/") == "5000":
    raise SystemExit("Refusing port 5000, the POC API")
print(f"PGHOST={shlex.quote(host)}")
print(f"PGPORT={port}")
print(f"PGUSER={shlex.quote(user)}")
print(f"PGPASSWORD={shlex.quote(password)}")
print(f"PGDATABASE={shlex.quote(database)}")
print(f"OBSERVE_BASE={shlex.quote(base)}")
PY
)"

export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
seconds="${OBSERVE_SECONDS:-60}"
interval="${OBSERVE_INTERVAL:-5}"
mkdir -p "$(dirname "$0")/../reports"
stamp="$(date +%Y%m%d-%H%M%S)"
log="$(dirname "$0")/../reports/observe-${stamp}.log"
api_port="${OBSERVE_BASE##*:}"
api_port="${api_port%%/*}"

echo "Sampling ${PGDATABASE} on ${PGHOST}:${PGPORT} for ${seconds}s" | tee "$log"
echo "API origin ${OBSERVE_BASE}. Password is not written to the log." | tee -a "$log"

deadline=$((SECONDS + seconds))
while (( SECONDS < deadline )); do
    {
        echo "----- $(date --iso-8601=seconds) -----"
        pid="$(ss -ltnp 2>/dev/null | awk -v port=":${api_port}" '$4 ~ port { print; found=1 } END { if (!found) print "api-listener-not-found" }')"
        echo "listener ${pid}"
        api_pid="$(ss -ltnp 2>/dev/null | sed -n "s/.*:${api_port} .*pid=\\([0-9]*\\).*/\\1/p" | head -n 1)"
        if [[ -n "${api_pid}" ]]; then
            ps -p "${api_pid}" -o pid=,pcpu=,rss=,cmd=
        fi
        psql -v ON_ERROR_STOP=1 -X -q -c "DO \$\$ BEGIN IF current_database() IS DISTINCT FROM 'hospital_management_loadtest' THEN RAISE EXCEPTION 'wrong database %', current_database(); END IF; END \$\$;"
        psql -v ON_ERROR_STOP=1 -X -c "
            SELECT count(*) AS connections,
                   count(*) FILTER (WHERE state = 'active') AS active,
                   count(*) FILTER (WHERE wait_event_type = 'Lock') AS lock_waits
            FROM pg_stat_activity
            WHERE datname = current_database();
        "
        if psql -v ON_ERROR_STOP=1 -X -tA -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'" | grep -q 1; then
            psql -v ON_ERROR_STOP=1 -X -c "
                SELECT round(mean_exec_time::numeric, 2) AS mean_ms,
                       calls,
                       left(query, 180) AS query
                FROM pg_stat_statements
                WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
                ORDER BY mean_exec_time DESC
                LIMIT 5;
            "
        else
            echo "pg_stat_statements is not installed on this cluster. Query latency rows are unavailable."
        fi
    } >>"$log" 2>&1 || echo "sample failed; continuing" >>"$log"
    sleep "$interval"
done

echo "Wrote ${log}"
