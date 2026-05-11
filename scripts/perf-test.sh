#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:5000/health}"
CONCURRENCY="${CONCURRENCY:-20}"
REQUESTS="${REQUESTS:-200}"

if command -v ab >/dev/null 2>&1; then
  ab -n "$REQUESTS" -c "$CONCURRENCY" "$URL"
else
  echo "Apache Bench (ab) not installed. Try: sudo apt-get install apache2-utils"
  exit 1
fi
