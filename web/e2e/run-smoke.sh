#!/usr/bin/env bash
# E2E smoke runner — restarts wrangler between each spec to avoid worker crash
set -e
WORKER_DIR="${WORKER_DIR:-../worker}"
SPECS_DIR="e2e/smoke"
SPECS=(
  foundation-admin.spec.ts
  sprint5a-daily-health.spec.ts
  sprint5b-hydration.spec.ts
  sprint5c-ai-infra.spec.ts
  sprint5d-cycle.spec.ts
  sprint5e-telegram.spec.ts
  regression-sprint1-4.spec.ts
  sprint6-ai-clinical.spec.ts
  sprint6-whatsapp-linking.spec.ts
  sprint6-webhook.spec.ts
  sprint6-cross-worker.spec.ts
)

PASSED=()
FAILED=()

ensure_worker() {
  kill $(lsof -t -i:8787) 2>/dev/null || true
  sleep 1
  cd "$WORKER_DIR"
  nohup npx wrangler dev --port 8787 --local > /tmp/e2e-wrangler.log 2>&1 &
  WKR_PID=$!
  cd -
  for i in $(seq 1 10); do
    if curl -m 2 -s http://localhost:8787/ -o /dev/null 2>/dev/null; then
      echo "  Worker ready (PID $WKR_PID)"
      return 0
    fi
    sleep 1
  done
  echo "  Worker failed to start"
  return 1
}

for spec in "${SPECS[@]}"; do
  echo "=== $spec ==="
  ensure_worker
  if npx playwright test "$SPECS_DIR/$spec" --project=chromium --reporter=line 2>&1; then
    PASSED+=("$spec")
  else
    FAILED+=("$spec")
  fi
  kill $(lsof -t -i:8787) 2>/dev/null || true
  sleep 1
done

echo ""
echo "=== SUMMARY ==="
echo "PASSED: ${#PASSED[@]}  ${PASSED[*]}"
echo "FAILED: ${#FAILED[@]}  ${FAILED[*]}"
[[ ${#FAILED[@]} -eq 0 ]] && echo "ALL SMOKE TESTS PASS" || echo "SOME SMOKE TESTS FAILED"
