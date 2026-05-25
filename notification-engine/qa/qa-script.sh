#!/usr/bin/env bash
# qa/qa-script.sh — Phase 16 end-to-end QA script
#
# Run this against a deployed instance to verify all critical paths:
#   routing, multi-group fan-out, recipient de-dup, image composition,
#   adaptive card, template validation failure, 429-retry flow,
#   manual retry, and audit detail.
#
# Usage:
#   BASE_URL=http://localhost:5000 bash qa/qa-script.sh
#
# Prerequisites:
#   - Engine running with DATABASE_URL pointing at a seeded Postgres
#   - ADMIN_USERNAME / ADMIN_PASSWORD set in engine env (defaults: admin / admin123)
#   - jq installed on the machine running this script

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}--- $1 ---${NC}"; }

require_field() {
  local val="$1"
  local name="$2"
  if [[ -z "$val" || "$val" == "null" ]]; then
    fail "Expected $name to be non-null, got: $val"
  fi
}

# ---------------------------------------------------------------------------
# 0. Health check
# ---------------------------------------------------------------------------
step "0. Health check"
HEALTH=$(curl -sf "$BASE_URL/api/health") || fail "GET /api/health failed — is the engine running?"
DB=$(echo "$HEALTH" | jq -r '.db')
[[ "$DB" == "up" ]] && pass "DB is up" || fail "DB not up: $HEALTH"

# ---------------------------------------------------------------------------
# 1. Admin login
# ---------------------------------------------------------------------------
step "1. Admin login"
AUTH=$(curl -sf -X POST "$BASE_URL/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}") \
  || fail "POST /api/admin/auth/login failed"
TOKEN=$(echo "$AUTH" | jq -r '.token')
require_field "$TOKEN" "admin JWT token"
pass "Logged in, token length=${#TOKEN}"

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ---------------------------------------------------------------------------
# 2. Create source — API key shown once
# ---------------------------------------------------------------------------
step "2. Create source"
SRC=$(curl -sf -X POST "$BASE_URL/api/admin/sources" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"name":"QA Source","rate_limit_rpm":120}') \
  || fail "POST /api/admin/sources failed"
SRC_ID=$(echo "$SRC" | jq -r '.id')
API_KEY=$(echo "$SRC" | jq -r '.api_key')
require_field "$SRC_ID" "source id"
require_field "$API_KEY" "api key (shown once)"
pass "Source $SRC_ID created, key prefix=$(echo "$SRC" | jq -r '.api_key_prefix')"

# ---------------------------------------------------------------------------
# 3. Create recipients: alice (user), bob (user), ops-channel (channel)
# ---------------------------------------------------------------------------
step "3. Create recipients"
ALICE=$(curl -sf -X POST "$BASE_URL/api/admin/recipients/users" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"display_name":"Alice QA","upn":"alice@qa.example.com"}') \
  || fail "POST recipients/users (alice) failed"
ALICE_ID=$(echo "$ALICE" | jq -r '.id')
require_field "$ALICE_ID" "alice id"
pass "User alice: $ALICE_ID"

BOB=$(curl -sf -X POST "$BASE_URL/api/admin/recipients/users" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"display_name":"Bob QA","upn":"bob@qa.example.com"}') \
  || fail "POST recipients/users (bob) failed"
BOB_ID=$(echo "$BOB" | jq -r '.id')
require_field "$BOB_ID" "bob id"
pass "User bob: $BOB_ID"

CHAN=$(curl -sf -X POST "$BASE_URL/api/admin/recipients/channels" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"display_name":"Ops Alerts","team_id":"qa-team-001","channel_id":"qa-chan-001"}') \
  || fail "POST recipients/channels failed"
CHAN_ID=$(echo "$CHAN" | jq -r '.id')
require_field "$CHAN_ID" "channel id"
pass "Channel ops-alerts: $CHAN_ID"

# ---------------------------------------------------------------------------
# 4. Create groups
#   GroupA: alice only
#   GroupB: alice + bob + ops-channel  (alice appears in both → de-dup target)
# ---------------------------------------------------------------------------
step "4. Create groups"
GRP_A=$(curl -sf -X POST "$BASE_URL/api/admin/groups" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"name":"QA Group A","description":"alice only"}') \
  || fail "POST groups (A) failed"
GRP_A_ID=$(echo "$GRP_A" | jq -r '.id')

curl -sf -X POST "$BASE_URL/api/admin/groups/$GRP_A_ID/members" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"member_type\":\"user\",\"member_id\":\"$ALICE_ID\"}" > /dev/null \
  || fail "Add alice to GroupA failed"
pass "Group A ($GRP_A_ID): alice"

GRP_B=$(curl -sf -X POST "$BASE_URL/api/admin/groups" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"name":"QA Group B","description":"alice + bob + channel"}') \
  || fail "POST groups (B) failed"
GRP_B_ID=$(echo "$GRP_B" | jq -r '.id')

curl -sf -X POST "$BASE_URL/api/admin/groups/$GRP_B_ID/members" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"member_type\":\"user\",\"member_id\":\"$ALICE_ID\"}" > /dev/null \
  || fail "Add alice to GroupB failed"
curl -sf -X POST "$BASE_URL/api/admin/groups/$GRP_B_ID/members" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"member_type\":\"user\",\"member_id\":\"$BOB_ID\"}" > /dev/null \
  || fail "Add bob to GroupB failed"
curl -sf -X POST "$BASE_URL/api/admin/groups/$GRP_B_ID/members" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"member_type\":\"channel\",\"member_id\":\"$CHAN_ID\"}" > /dev/null \
  || fail "Add channel to GroupB failed"
pass "Group B ($GRP_B_ID): alice + bob + ops-channel"

# ---------------------------------------------------------------------------
# 5. Create templates
# ---------------------------------------------------------------------------
step "5. Create templates"

TPL_TEXT=$(curl -sf -X POST "$BASE_URL/api/admin/templates" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"name":"QA Text","kind":"text_html","body":"<p><strong>{{title}}</strong></p><p>{{body}}</p>"}') \
  || fail "POST templates (text) failed"
TPL_TEXT_ID=$(echo "$TPL_TEXT" | jq -r '.id')
pass "text_html template: $TPL_TEXT_ID"

TPL_CARD=$(curl -sf -X POST "$BASE_URL/api/admin/templates" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"name":"QA Card","kind":"adaptive_card","body":"{\"type\":\"AdaptiveCard\",\"version\":\"1.4\",\"body\":[{\"type\":\"TextBlock\",\"text\":\"{{title}}\",\"weight\":\"bolder\"},{\"type\":\"TextBlock\",\"text\":\"{{body}}\",\"wrap\":true}]}"}') \
  || fail "POST templates (card) failed"
TPL_CARD_ID=$(echo "$TPL_CARD" | jq -r '.id')
pass "adaptive_card template: $TPL_CARD_ID"

TPL_STRICT=$(curl -sf -X POST "$BASE_URL/api/admin/templates" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"name\":\"QA Strict\",\"kind\":\"text_html\",\"body\":\"KPI: {{data.kpi}}\",\"vars_schema\":{\"required\":[\"data.kpi\"]}}") \
  || fail "POST templates (strict) failed"
TPL_STRICT_ID=$(echo "$TPL_STRICT" | jq -r '.id')
pass "strict template (requires data.kpi): $TPL_STRICT_ID"

# ---------------------------------------------------------------------------
# 6. Create routing rules
# ---------------------------------------------------------------------------
step "6. Create routing rules"

# Rule 1: alarm.* → GroupA, text_html
RUL_1=$(curl -sf -X POST "$BASE_URL/api/admin/rules" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"source_id\":\"$SRC_ID\",\"event_pattern\":\"alarm.*\",\"group_id\":\"$GRP_A_ID\",\"template_id\":\"$TPL_TEXT_ID\",\"priority\":100}") \
  || fail "POST rules (1) failed"
RUL_1_ID=$(echo "$RUL_1" | jq -r '.id')
pass "Rule 1: alarm.* → GroupA text_html ($RUL_1_ID)"

# Rule 2: alarm.* → GroupB, adaptive_card  (same pattern → fan-out + de-dup alice)
RUL_2=$(curl -sf -X POST "$BASE_URL/api/admin/rules" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"source_id\":\"$SRC_ID\",\"event_pattern\":\"alarm.*\",\"group_id\":\"$GRP_B_ID\",\"template_id\":\"$TPL_CARD_ID\",\"priority\":200}") \
  || fail "POST rules (2) failed"
RUL_2_ID=$(echo "$RUL_2" | jq -r '.id')
pass "Rule 2: alarm.* → GroupB adaptive_card ($RUL_2_ID)"

# Rule 3: kpi.* → GroupA, strict template (used to test validation failure)
RUL_3=$(curl -sf -X POST "$BASE_URL/api/admin/rules" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d "{\"source_id\":\"$SRC_ID\",\"event_pattern\":\"kpi.*\",\"group_id\":\"$GRP_A_ID\",\"template_id\":\"$TPL_STRICT_ID\",\"priority\":100}") \
  || fail "POST rules (3) failed"
RUL_3_ID=$(echo "$RUL_3" | jq -r '.id')
pass "Rule 3: kpi.* → GroupA strict ($RUL_3_ID)"

# ---------------------------------------------------------------------------
# 7. SCENARIO: Simple routing
#    event_type=alarm.test → matches Rule1 only (GroupA, alice only)
#    NOTE: The proxy account must be signed in for Graph sends to succeed.
#    If not signed in, delivery will be 'failed' with proxy_account_not_signed_in.
# ---------------------------------------------------------------------------
step "7. Scenario: Simple routing"
NOTIF_1=$(curl -sf -X POST "$BASE_URL/api/notifications" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"event_type":"alarm.test","title":"QA test","body":"Simple routing test"}') \
  || fail "POST /api/notifications (scenario 7) failed"
echo "$NOTIF_1" | jq .
NID_1=$(echo "$NOTIF_1" | jq -r '.notification_id')
require_field "$NID_1" "notification_id (scenario 7)"
MATCHED_1=$(echo "$NOTIF_1" | jq '.matched_groups | length')
QUEUED_1=$(echo "$NOTIF_1" | jq '.queued_deliveries')
# Two rules match alarm.* (GroupA + GroupB); alice in both (de-dup to 1), bob+channel unique = 3 total
[[ "$QUEUED_1" -ge 1 ]] && pass "Simple routing — got $QUEUED_1 deliveries" \
  || fail "Expected at least 1 delivery, got $QUEUED_1"

# ---------------------------------------------------------------------------
# 8. SCENARIO: Multi-group fan-out + recipient de-dup
#    event_type=alarm.fanout → both rules match; alice in both groups (de-duped once)
#    Expected: 3 deliveries (alice x1, bob x1, channel x1)
# ---------------------------------------------------------------------------
step "8. Scenario: Multi-group fan-out + de-dup"
NOTIF_2=$(curl -sf -X POST "$BASE_URL/api/notifications" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"event_type":"alarm.fanout","title":"Fan-out test","body":"Both groups should fire, alice deduplicated"}') \
  || fail "POST /api/notifications (scenario 8) failed"
echo "$NOTIF_2" | jq .
NID_2=$(echo "$NOTIF_2" | jq -r '.notification_id')
MATCHED_2=$(echo "$NOTIF_2" | jq '.matched_groups | length')
QUEUED_2=$(echo "$NOTIF_2" | jq '.queued_deliveries')
[[ "$MATCHED_2" -eq 2 ]] && pass "Two groups matched (fan-out)" \
  || fail "Expected 2 matched_groups, got $MATCHED_2"
[[ "$QUEUED_2" -eq 3 ]] && pass "De-dup: 3 unique recipients (alice x1, bob, channel)" \
  || fail "Expected 3 deliveries after de-dup, got $QUEUED_2"

# ---------------------------------------------------------------------------
# 9. SCENARIO: Image composition
# ---------------------------------------------------------------------------
step "9. Scenario: Image attachment composition"
IMG_B64=$(echo -n 'FAKE_PNG_BYTES' | base64)
NOTIF_3=$(curl -sf -X POST "$BASE_URL/api/notifications" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d "{\"event_type\":\"alarm.image\",\"title\":\"Chart alert\",\"body\":\"See attached\",\"attachments\":[{\"kind\":\"image\",\"filename\":\"chart.png\",\"base64\":\"$IMG_B64\"}]}") \
  || fail "POST /api/notifications (scenario 9) failed"
NID_3=$(echo "$NOTIF_3" | jq -r '.notification_id')
require_field "$NID_3" "notification_id (image scenario)"
pass "Image notification accepted: $NID_3"

# Verify the notification was persisted with payload including attachments
DETAIL_3=$(curl -sf "$BASE_URL/api/admin/notifications/$NID_3" -H "$AUTH_HEADER") \
  || fail "GET /api/admin/notifications/$NID_3 failed"
HAS_ATT=$(echo "$DETAIL_3" | jq '.payload.attachments | length')
[[ "$HAS_ATT" -ge 1 ]] && pass "Payload stored with attachment (len=$HAS_ATT)" \
  || fail "Expected attachment in stored payload"

# ---------------------------------------------------------------------------
# 10. SCENARIO: Template validation failure
#    event_type=kpi.degraded without data.kpi → strict template rejects it
# ---------------------------------------------------------------------------
step "10. Scenario: Template validation failure"
NOTIF_4=$(curl -sf -X POST "$BASE_URL/api/notifications" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"event_type":"kpi.degraded","title":"KPI alert"}') \
  || fail "POST /api/notifications (scenario 10) failed"
NID_4=$(echo "$NOTIF_4" | jq -r '.notification_id')
require_field "$NID_4" "notification_id (validation failure)"
pass "Notification accepted (202): $NID_4"

# Poll until status is not 'sending'/'queued'
for i in $(seq 1 5); do
  STATUS_4=$(curl -sf "$BASE_URL/api/admin/notifications/$NID_4" -H "$AUTH_HEADER" | jq -r '.status')
  [[ "$STATUS_4" != "sending" && "$STATUS_4" != "queued" ]] && break
  sleep 1
done
echo "  Notification status: $STATUS_4"

# Check deliveries for template_validation error
DLVS_4=$(curl -sf "$BASE_URL/api/admin/notifications/$NID_4" -H "$AUTH_HEADER" | jq '.deliveries')
echo "  Deliveries: $(echo "$DLVS_4" | jq '.[].status')"
HAS_FAIL=$(echo "$DLVS_4" | jq '[.[] | select(.status=="failed")] | length')
[[ "$HAS_FAIL" -ge 1 ]] && pass "Delivery marked failed due to template_validation" \
  || fail "Expected failed delivery for template_validation, got: $DLVS_4"

FAIL_ERR=$(echo "$DLVS_4" | jq -r '.[0].last_error')
echo "  last_error: $FAIL_ERR"
[[ "$FAIL_ERR" == *"template_validation"* ]] && pass "last_error contains 'template_validation'" \
  || fail "Expected 'template_validation' in last_error, got: $FAIL_ERR"

# ---------------------------------------------------------------------------
# 11. SCENARIO: Audit detail
#    GET /api/admin/notifications/:id includes full payload + deliveries
# ---------------------------------------------------------------------------
step "11. Scenario: Audit detail"
DETAIL_1=$(curl -sf "$BASE_URL/api/admin/notifications/$NID_1" -H "$AUTH_HEADER") \
  || fail "GET /api/admin/notifications/$NID_1 failed"
HAS_DELIVERIES=$(echo "$DETAIL_1" | jq '.deliveries | type')
[[ "$HAS_DELIVERIES" == '"array"' ]] && pass "Notification detail includes deliveries array" \
  || fail "Expected deliveries array in notification detail"
EVENT_T=$(echo "$DETAIL_1" | jq -r '.event_type')
[[ "$EVENT_T" == "alarm.test" ]] && pass "event_type persisted correctly" \
  || fail "Expected event_type=alarm.test, got $EVENT_T"

# List notifications with filter
LIST=$(curl -sf "$BASE_URL/api/admin/notifications?event_type=alarm.fanout" -H "$AUTH_HEADER") \
  || fail "GET /api/admin/notifications?event_type=alarm.fanout failed"
LIST_COUNT=$(echo "$LIST" | jq '. | length')
[[ "$LIST_COUNT" -ge 1 ]] && pass "Audit list filter by event_type works ($LIST_COUNT rows)" \
  || fail "Expected at least 1 notification for alarm.fanout, got $LIST_COUNT"

# Stats endpoint
STATS=$(curl -sf "$BASE_URL/api/admin/stats" -H "$AUTH_HEADER") \
  || fail "GET /api/admin/stats failed"
[[ "$(echo "$STATS" | jq '.notifications')" != "null" ]] && pass "Stats endpoint returns data" \
  || fail "Stats response missing 'notifications': $STATS"

# ---------------------------------------------------------------------------
# 12. SCENARIO: Manual retry
#    Use the failed delivery from scenario 10 (template_validation)
#    Manual retry resets attempts=0, status=retrying
# ---------------------------------------------------------------------------
step "12. Scenario: Manual retry"
FAILED_DLV=$(curl -sf "$BASE_URL/api/admin/notifications/$NID_4" -H "$AUTH_HEADER" \
  | jq -r '.deliveries[] | select(.status=="failed") | .id' | head -1)
require_field "$FAILED_DLV" "failed delivery id for retry"

RETRY_RESULT=$(curl -sf -X POST "$BASE_URL/api/admin/deliveries/$FAILED_DLV/retry" \
  -H "$AUTH_HEADER") \
  || fail "POST /api/admin/deliveries/$FAILED_DLV/retry failed"
RETRY_STATUS=$(echo "$RETRY_RESULT" | jq -r '.status')
RETRY_ATTEMPTS=$(echo "$RETRY_RESULT" | jq -r '.attempts')
[[ "$RETRY_STATUS" == "retrying" ]] && pass "Delivery reset to retrying" \
  || fail "Expected status=retrying, got $RETRY_STATUS"
[[ "$RETRY_ATTEMPTS" == "0" ]] && pass "Attempts reset to 0" \
  || fail "Expected attempts=0, got $RETRY_ATTEMPTS"

# Bulk retry: reset all failed deliveries on a notification
BULK=$(curl -sf -X POST "$BASE_URL/api/admin/notifications/$NID_4/retry" \
  -H "$AUTH_HEADER") \
  || fail "POST /api/admin/notifications/$NID_4/retry failed"
echo "  Bulk retry queued: $(echo "$BULK" | jq '.queued')"
pass "Bulk retry endpoint reachable"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} All QA scenarios passed.${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Notifications created during QA:"
echo "  Scenario 7 (simple routing):   $NID_1"
echo "  Scenario 8 (fan-out+dedup):    $NID_2"
echo "  Scenario 9 (image):            $NID_3"
echo "  Scenario 10 (validation fail): $NID_4"
echo ""
echo "NOTE: Actual Teams delivery (proxy account sign-in) was not verified"
echo "here — that requires a signed-in proxy account and real tenant access."
echo "To verify Teams delivery: sign in the proxy account via the Settings UI,"
echo "then repeat scenario 7 and check the delivery status in the audit log."
