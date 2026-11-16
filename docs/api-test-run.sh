#!/usr/bin/env bash
# API smoke-test runner — see docs/FUNCTIONS-TEST-LIST.md
# Needs: backend :5000, admin-web dev :5174, tmp_emu/ptok.txt (player JWT), tmp_emu/ck.txt (admin cookie)
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-http://localhost:5000/api/v1}"
ORIGIN="http://localhost:5174"
TENANT="53a09545-e6e2-4cf5-a5c2-7ef18b276a52"
CK="${CK:-$ROOT/tmp_emu/ck.txt}"
PT=$(cat "$ROOT/tmp_emu/ptok.txt" 2>/dev/null || echo "")
R="$ROOT/tmp_emu/_r.json"

pass=0; fail=0

jget() { PYTHONIOENCODING=utf-8 python -c "
import json
d=json.load(open(r'$R',encoding='utf-8'))
print($1)
" 2>/dev/null; }

# hit <num> <label> <expect> <method> <path> [body] [auth]
hit() {
  local num="$1" label="$2" want="$3" method="$4" path="$5" body="${6:-}" auth="${7:-admin}"
  local args=(-s -o "$R" -w '%{http_code}' -X "$method" "$BASE$path" -H "Origin: $ORIGIN")
  case "$auth" in
    admin)  args+=(-b "$CK") ;;
    player) args+=(-H "Authorization: Bearer $PT") ;;
    none)   ;;
  esac
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")

  local code
  code=$(curl "${args[@]}" 2>/dev/null)

  if [ "$code" = "$want" ]; then
    pass=$((pass+1)); printf 'PASS | %-3s | %-32s | %s\n' "$num" "$label" "$code"
  else
    fail=$((fail+1))
    printf 'FAIL | %-3s | %-32s | got %s want %s | %s\n' "$num" "$label" "$code" "$want" "$(head -c 90 "$R" | tr -d '\n')"
  fi
}

echo "--- PLAYER AUTH / PROFILE ---"
hit 6  "player/login"             200 POST "/auth/player/login" "{\"tenantId\":\"$TENANT\",\"phoneNumber\":\"9876500022\",\"idToken\":\"dev_otp_9876500022\"}" none
hit 16 "auth/fcm-token"           200 POST "/auth/fcm-token" "{\"token\":\"$(printf 'f%.0s' $(seq 1 130))\"}" player
hit 33 "players/me/stats"         200 GET  "/players/me/stats" "" player
hit 34 "players/me/game-profile"  200 PATCH "/players/me/game-profile" '{"inGameName":"TestGamer","inGameUid":"123456789"}' player

echo "--- TOURNAMENTS (player) ---"
hit 20 "tournaments list"         200 GET  "/tournaments?page=1&limit=5" "" player
MID=$(jget "d['data']['items'][0]['id']")
hit 25 "tournament detail"        200 GET  "/tournaments/$MID" "" player
hit 26 "tournament slots"         200 GET  "/tournaments/$MID/slots" "" player
hit 27 "tournament room (403=guard)" 403 GET "/tournaments/$MID/room" "" player
hit 28 "tournament results"       200 GET  "/tournaments/$MID/results" "" player

echo "--- WALLET (player) ---"
hit 35 "wallet balance"           200 GET  "/wallet" "" player
hit 36 "wallet ledger (in /wallet)" 200 GET "/wallet" "" player
hit 37 "wallet deposits"          200 GET  "/wallet/deposits" "" player

echo "--- TENANT / LIVE ---"
hit 61 "tenant settings (public)" 200 GET  "/tenant/settings?tenantId=$TENANT" "" none
hit 63 "live events"              200 GET  "/live/events" "" player
hit 64 "live budget"              200 GET  "/live/budget" "" admin

echo "--- ADMIN STAFF ---"
hit 11 "staff list"               200 GET  "/auth/admin/staff" "" admin

echo "--- ADMIN MATCHES ---"
AMID=$(curl -s -b "$CK" -H "Origin: $ORIGIN" "$BASE/tournaments?page=1&limit=1" | PYTHONIOENCODING=utf-8 python -c "import json,sys;print(json.load(sys.stdin)['data']['items'][0]['id'])" 2>/dev/null)
hit 29 "match participants"       200 GET  "/admin/matches/$AMID/participants" "" admin
hit 30 "roster CSV"               200 GET  "/admin/matches/$AMID/participants/export.csv" "" admin
PUID=$(curl -s -b "$CK" -H "Origin: $ORIGIN" "$BASE/admin/matches/$AMID/participants" | PYTHONIOENCODING=utf-8 python -c "import json,sys;print(json.load(sys.stdin)['data']['items'][0]['userId'])" 2>/dev/null)
hit 31 "payout (Rs1 probe)"       200 POST "/admin/matches/$AMID/payout" "{\"awards\":[{\"userId\":\"$PUID\",\"rank\":1,\"kills\":2,\"amount\":1}]}" admin

echo "--- ADMIN PLAYERS ---"
hit 49 "players list"             200 GET  "/admin/players?page=1&limit=5" "" admin
PID=$(jget "d['data']['items'][0]['id']")
hit 50 "player detail"            200 GET  "/admin/players/$PID" "" admin
hit 52 "suspicious players"       200 GET  "/admin/players/suspicious" "" admin
hit 57 "device groups"            200 GET  "/admin/players/devices" "" admin

echo "--- ADMIN WALLET ---"
hit 39 "deposits queue"           200 GET  "/admin/wallet/deposits" "" admin
hit 42 "withdrawals queue"        200 GET  "/admin/wallet/withdrawals" "" admin
hit 45 "payments list"            200 GET  "/admin/wallet/payments" "" admin
hit 47 "settlement"               200 GET  "/admin/wallet/settlement?date=$(date +%Y-%m-%d)" "" admin
hit 48 "settlement CSV"           200 GET  "/admin/wallet/settlement/export.csv?date=$(date +%Y-%m-%d)" "" admin

echo "--- MEDIA / PAYMENTS ---"
hit 65 "media config"             200 GET  "/media/config" "" admin
hit 67 "payments config"          200 GET  "/payments/config" "" player
hit 68 "payments my"              200 GET  "/payments/my" "" player
hit 69 "payment order create"     201 POST "/payments/orders" '{"amountPaise":10000}' player
OID=$(jget "d['data']['orderId']")
hit 70 "payment order status"     200 GET  "/payments/orders/$OID" "" player

echo "--- GUARD CASES ---"
hit G1 "no-auth rejected"          401 GET "/admin/wallet/deposits" "" none
hit G2 "player blocked from admin" 403 GET "/admin/players" "" player
hit G3 "unknown match 404"         404 GET "/tournaments/00000000-0000-0000-0000-000000000000" "" player
hit G4 "settlement bad date 400"   400 GET "/admin/wallet/settlement?date=16-11-2026" "" admin

echo
echo "===== PASS=$pass  FAIL=$fail ====="
