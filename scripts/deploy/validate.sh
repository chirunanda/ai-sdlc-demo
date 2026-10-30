#!/bin/bash
# Smoke test every layer. Any failure exits non-zero so CodeDeploy rolls back.
set -uo pipefail

check() {
  local name="$1" url="$2" tries=30
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      echo "OK   $name ($url)"
      return 0
    fi
    sleep 2
  done
  echo "FAIL $name ($url) after $tries attempts" >&2
  journalctl -u catalog-api -u catalog-bff -n 40 --no-pager >&2 || true
  return 1
}

check "Java API health"  "http://127.0.0.1:8080/actuator/health" || exit 1
check "BFF health"       "http://127.0.0.1:3000/health"          || exit 1
check "End-to-end"       "http://127.0.0.1/api/products"          || exit 1
check "Frontend"         "http://127.0.0.1/"                      || exit 1
echo "All checks passed"
