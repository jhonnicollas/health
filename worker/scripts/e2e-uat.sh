#!/bin/bash
# E2E UAT Script for HL Health Companion Production
# Usage: API=https://hl-health-companion.indiehomesungairaya.workers.dev ./e2e-uat.sh

set -uo pipefail
API="${API:-https://hl-health-companion.indiehomesungairaya.workers.dev}"
COOKIE=$(mktemp)
EMAIL="uat.$(date +%s).$RANDOM@example.com"
PASS="UatPass123!"
PASSFAIL=0
PASSED=0
TOTAL=0

test_endpoint() {
  local name="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  if [[ "$actual" == *"$expected"* ]]; then
    echo "  PASS  $name"
    PASSED=$((PASSED+1))
  else
    echo "  FAIL  $name (expected: $expected)"
    PASSFAIL=$((PASSFAIL+1))
  fi
}

echo "==> API: $API"
echo "==> Email: $EMAIL"

echo ""
echo "==> Auth"
RESP=$(curl -s -X POST "$API/api/auth/register" -H "Content-Type: application/json" -c "$COOKIE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"UAT E2E\"}")
test_endpoint "register success" '"success":true' "$RESP"

RESP=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -c "$COOKIE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
test_endpoint "login success" '"success":true' "$RESP"

RESP=$(curl -s "$API/api/auth/me" -b "$COOKIE")
test_endpoint "me has userId" '"id":"usr_' "$RESP"

echo ""
echo "==> Onboarding"
ONB=$(curl -s -X POST "$API/api/profile/onboarding" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"displayName":"UAT E2E","sex":"male","birthDate":"1990-01-01","heightCm":175,"timezone":"Asia/Jakarta","accessibilityMode":"normal","aiConsent":true}')
PID=$(echo "$ONB" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['profileId'])")
test_endpoint "onboarding created profile" "prf_" "$PID"

echo ""
echo "==> Validation"
RESP=$(curl -s -X POST "$API/api/measurements/validate" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"metrics":[{"metricCode":"systolic","finalValue":120},{"metricCode":"diastolic","finalValue":80}]}')
test_endpoint "valid BP pair" '"valid":true' "$RESP"

RESP=$(curl -s -X POST "$API/api/measurements/validate" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"metrics":[{"metricCode":"systolic","finalValue":80},{"metricCode":"diastolic","finalValue":90}]}')
test_endpoint "invalid BP pair (systolic<diastolic)" 'INVALID_PAIR' "$RESP"

echo ""
echo "==> Submit with rule engine (high BP)"
RESP=$(curl -s -X POST "$API/api/measurements/submit" -H "Content-Type: application/json" -b "$COOKIE" \
  -d "{\"profileId\":\"$PID\",\"source\":\"manual\",\"values\":[{\"metricCode\":\"systolic\",\"finalValue\":150,\"unit\":\"mmHg\"},{\"metricCode\":\"diastolic\",\"finalValue\":100,\"unit\":\"mmHg\"},{\"metricCode\":\"spo2\",\"finalValue\":97,\"unit\":\"%\"}]}")
test_endpoint "submit success" '"success":true' "$RESP"
test_endpoint "rule applied: Hipertensi Tahap 2" 'Hipertensi Tahap 2' "$RESP"

echo ""
echo "==> US-1.4.3 BMI auto-calc"
RESP=$(curl -s -X POST "$API/api/measurements/submit" -H "Content-Type: application/json" -b "$COOKIE" \
  -d "{\"profileId\":\"$PID\",\"source\":\"manual\",\"values\":[{\"metricCode\":\"bodyWeight\",\"finalValue\":80,\"unit\":\"kg\"}]}")
test_endpoint "BMI auto-calculated" '"metricCode":"bmi"' "$RESP"
test_endpoint "BMI value ~26.1" '"finalValue":26' "$RESP"

echo ""
echo "==> US-2.1.3 Rule Fallback"
RESP=$(curl -s -X POST "$API/api/measurements/submit" -H "Content-Type: application/json" -b "$COOKIE" \
  -d "{\"profileId\":\"$PID\",\"source\":\"manual\",\"values\":[{\"metricCode\":\"height\",\"finalValue\":175,\"unit\":\"cm\"}]}")
test_endpoint "fallback status" 'Belum Ada Interpretasi' "$RESP"

echo ""
echo "==> Dashboard today"
RESP=$(curl -s "$API/api/dashboard/today" -b "$COOKIE")
test_endpoint "dashboard has data" '"hasData":true' "$RESP"

echo ""
echo "==> Weekly dashboard"
RESP=$(curl -s "$API/api/dashboard/weekly" -b "$COOKIE")
test_endpoint "weekly has metrics" '"metrics":' "$RESP"

echo ""
echo "==> Monthly dashboard"
RESP=$(curl -s "$API/api/dashboard/monthly" -b "$COOKIE")
test_endpoint "monthly has metrics" '"metrics":' "$RESP"

echo ""
echo "==> Daily report (US-2.5.1)"
RESP=$(curl -s "$API/api/reports/daily" -b "$COOKIE")
test_endpoint "daily has popupMessage" 'popupMessage' "$RESP"
test_endpoint "daily has recommendation" 'recommendation' "$RESP"

echo ""
echo "==> Weekly report (US-2.5.2)"
RESP=$(curl -s "$API/api/reports/weekly" -b "$COOKIE")
test_endpoint "weekly has bestDay" 'bestDay' "$RESP"
test_endpoint "weekly has alertCount" 'alertCount' "$RESP"
test_endpoint "weekly has adherence" 'adherence' "$RESP"

echo ""
echo "==> Monthly report (US-2.5.3)"
RESP=$(curl -s "$API/api/reports/monthly" -b "$COOKIE")
test_endpoint "monthly has aiSummary" 'aiMonthlySummary' "$RESP"
test_endpoint "monthly has latest" '"latest"' "$RESP"

echo ""
echo "==> AI recommendation (US-2.3.1/2/3)"
RESP=$(curl -s -X POST "$API/api/ai/recommendation" -H "Content-Type: application/json" -b "$COOKIE" -d '{}')
test_endpoint "AI rec has dataMessages" 'dataMessages' "$RESP"
test_endpoint "AI rec has safetyStatus" 'safetyStatus' "$RESP"

echo ""
echo "==> KB (US-2.5.4)"
RESP=$(curl -s "$API/api/kb")
test_endpoint "KB has Yuwell" 'yuwell-yx106' "$RESP"
test_endpoint "KB has OMRON" 'omron' "$RESP"
test_endpoint "KB has Sinocare" 'sinocare' "$RESP"

echo ""
echo "==> Pattern insights (US-2.4.x)"
RESP=$(curl -s -X POST "$API/api/patterns/generate" -H "Content-Type: application/json" -b "$COOKIE" -d '{"patternType":"sleep_bp"}')
test_endpoint "pattern returns message" 'insight' "$RESP"

echo ""
echo "==> Telegram (US-3.1.1)"
RESP=$(curl -s -X POST "$API/api/telegram/connect" -b "$COOKIE")
test_endpoint "telegram connect code" 'verificationCode' "$RESP"

echo ""
echo "==> Emergency contacts (US-3.3.x)"
RESP=$(curl -s -X POST "$API/api/emergency/contacts" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"name":"Spouse","phone":"+6281234567890","relationship":"spouse"}')
test_endpoint "emergency contact added" '"success":true' "$RESP"

echo ""
echo "==> Reminders (US-3.4.x)"
RESP=$(curl -s -X POST "$API/api/reminders" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"time":"08:00","label":"Pagi","metricCode":"bloodPressure"}')
test_endpoint "reminder created" '"success":true' "$RESP"

echo ""
echo "==> Family invite (US-3.2.1)"
RESP=$(curl -s -X POST "$API/api/family/invite" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"email":"caregiver@example.com","role":"caregiver"}')
test_endpoint "family invite created" 'inviteUrl' "$RESP"

echo ""
echo "==> Sync draft (US-4.6.3)"
RESP=$(curl -s -X POST "$API/api/measurements/sync" -H "Content-Type: application/json" -b "$COOKIE" \
  -d '{"drafts":[{"clientId":"d1","metrics":["spo2"]}]}')
test_endpoint "draft sync without profileId" '"success":true' "$RESP"

echo ""
echo "==> Export CSV (US-4.7.1)"
RESP=$(curl -s -i "$API/api/export/csv" -b "$COOKIE")
test_endpoint "CSV content-type" 'text/csv' "$RESP"

echo ""
echo "==> Metrics catalog"
RESP=$(curl -s "$API/api/metrics/catalog" -b "$COOKIE")
test_endpoint "catalog has devices" 'devices' "$RESP"

echo ""
echo "==> Auth middleware"
RESP=$(curl -s "$API/api/dashboard/today")
test_endpoint "unauth dashboard rejected" 'UNAUTHORIZED' "$RESP"

rm -f "$COOKIE"

echo ""
echo "=========================================="
echo "RESULTS: $PASSED/$TOTAL passed, $PASSFAIL failed"
echo "=========================================="
exit $PASSFAIL
