#!/usr/bin/env bash
set -e
BASE_URL="https://hl-health-companion-api.indiehomesungairaya.workers.dev"
OUTDIR="stress-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTDIR"

echo "=========================================="
echo " HL Health Companion — Production Stress Test"
echo " Target: $BASE_URL"
echo " Output: $OUTDIR"
echo " Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=========================================="

SCENARIOS=(
  "smoke.js|Smoke Load|5m|10 VUs"
  "foundation.js|F-ST-001 Entitlement Storm|15m|50 VUs"
  "sprint5a.js|A-ST-002/003 Hub + Red Flag|15m|50 VUs"
  "sprint5b.js|B-ST-001/003 Hydration Burst|1m ramp|100 VUs"
  "sprint5c.js|C-ST-003/004 AI Infra|10m|50 VUs"
  "sprint5d.js|D-ST-001/002 Cycle Calendar|15m|50 VUs"
  "sprint5e.js|E-ST-001/002 Telegram|10m|50 VUs"
  "spike.js|Spike Load|7m|500 VUs"
  "abuse.js|Abuse Load|15m|200 VUs"
)

for entry in "${SCENARIOS[@]}"; do
  IFS='|' read -r file label duration vus <<< "$entry"
  echo ""
  echo ">>> [$(date -u +%H:%M:%S)] Starting: $label ($file) — $duration / $vus"
  k6 run --env BASE_URL="$BASE_URL" \
         --summary-export="$OUTDIR/${file%.js}-summary.json" \
         "stress/$file" 2>&1 | tee "$OUTDIR/${file%.js}.log"
  echo "<<< [$(date -u +%H:%M:%S)] Completed: $label"
done

echo ""
echo "=========================================="
echo " All scenarios completed"
echo " Finished: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo " Results: $OUTDIR"
echo "=========================================="
