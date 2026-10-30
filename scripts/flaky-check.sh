#!/bin/bash
# Runs each test suite several times. A suite that both passes and fails is flaky.
# Usage: scripts/flaky-check.sh [runs]   (default 5)
set -uo pipefail
RUNS="${1:-5}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
EXIT=0

run_suite() {
  local name="$1" dir="$2"; shift 2
  local pass=0 fail=0
  for ((i = 1; i <= RUNS; i++)); do
    if (cd "$dir" && "$@" >/tmp/flaky-"$name"-"$i".log 2>&1); then pass=$((pass + 1)); else fail=$((fail + 1)); fi
  done
  local verdict="stable"
  if ((fail > 0 && pass > 0)); then verdict="FLAKY"; EXIT=1
  elif ((fail == RUNS)); then verdict="BROKEN"; EXIT=1; fi
  echo "| $name | $pass | $fail | $verdict |" >>"$SUMMARY"
}

{
  echo "## Flaky test check ($RUNS runs per suite)"
  echo
  echo "| Suite | Passed | Failed | Verdict |"
  echo "|---|---|---|---|"
} >>"$SUMMARY"

run_suite frontend frontend npm test
run_suite bff bff npm test
run_suite api api mvn -B -ntp -q test

exit "$EXIT"
