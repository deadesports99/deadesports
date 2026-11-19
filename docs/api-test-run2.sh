#!/usr/bin/env bash
# Part 2 sweep — destructive / stateful endpoints from docs/FUNCTIONS-TEST-LIST.md
# Covers: player register, email OTP, Google guard, staff CRUD, access keys,
# watchlist, device groups + ban, media. Self-cleaning (creates then reverts).
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE:-http://localhost:5000/api/v1}"
ORIGIN="http://localhost:5174"
TENANT="53a09545-e6e2-4cf5-a5c2-7ef18b276a52"
CK="${CK:-$ROOT/tmp_emu/ck.txt}"
PT=$(cat "$ROOT/tmp_emu/ptok.txt" 2>/dev/null || echo "")
R="$ROOT/tmp_emu/_r2.json"

pass=0; fail=0
STAMP=$(date +%s)

jget() { PYTHONIOENCODING=utf-8 R_JSON="$R" EXPR="$1" python -c "
import json, os
d = json.load(open(os.environ['R_JSON'], encoding='utf-8'))
print(eval(os.environ['EXPR']))
" 2>/dev/null | tr -d '\r\n'; }

ok()   { pass=$((pass+1)); printf 'PASS | %-4s | %-34s | %s\n' "$1" "$2" "$3"; }
bad()  { fail=$((fail+1)); printf 'FAIL | %-4s | %-34s | %s\n' "$1" "$2" "$3"; }

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
  if [ "$code" = "$want" ]; then ok "$num" "$label" "$code"
  else bad "$num" "$label" "got $code want $want | $(head -c 80 "$R" | tr -d '\n')"; fi
}

echo "--- PLAYER REGISTER (dev OTP bypass) ---"
NEWPHONE="9$(printf '%09d' $((STAMP % 100000000)))"
hit 1 "player register (new phone)"  201 POST "/auth/player/register" \
  "{\"tenantId\":\"$TENANT\",\"phoneNumber\":\"$NEWPHONE\",\"idToken\":\"dev_otp_$NEWPHONE\",\"name\":\"Sweep Test\"}" none
NEWID=$(jget "d['data']['user']['id']")
echo "     -> new player $NEWPHONE ($NEWID)"

hit 4 "google login guard"           401 POST "/auth/player/google" \
  "{\"tenantId\":\"$TENANT\",\"idToken\":\"not-a-real-google-token\"}" none

echo "--- ADMIN STAFF CRUD ---"
SMAIL="staff$STAMP@example.com"
SPHONE="8$(printf '%09d' $((STAMP % 100000000)))"
hit 5 "staff create"                 201 POST "/auth/admin/staff" \
  "{\"name\":\"Sweep Staff\",\"email\":\"$SMAIL\",\"phoneNumber\":\"$SPHONE\",\"permissions\":{\"canManageWallet\":true}}" admin
SID=$(jget "d['data']['user']['id']")
echo "     -> staff $SMAIL ($SID)"

hit 6 "staff listed after create"    200 GET "/auth/admin/staff" "" admin
FOUND=$(jget "'$SID' in [u['id'] for u in d['data']['staff']]")
[ "$FOUND" = "True" ] && ok 6b "new staff appears in list" "found" || bad 6b "new staff appears in list" "not found"

hit 7 "staff permissions patch"      200 PATCH "/auth/admin/staff/$SID" '{"permissions":{"canCreateMatch":true}}' admin
CANCREATE=$(jget "d['data']['staff']['permissions']['canCreateMatch']")
echo "     -> canCreateMatch now: $CANCREATE"

hit 8 "staff remove (deactivate)"    200 DELETE "/auth/admin/staff/$SID" "" admin
hit 9 "removed staff still 200 list" 200 GET "/auth/admin/staff" "" admin
STILL_ACTIVE=$(jget "[u.get('isActive') for u in d['data']['staff'] if u['id']=='$SID']")
echo "     -> isActive after remove: $STILL_ACTIVE"

echo "--- ACCESS KEYS ---"
KMAIL="ops$STAMP@example.com"
KPHONE="7$(printf '%09d' $((STAMP % 100000000)))"
hit 10 "access key issue"            201 POST "/admin/access" \
  "{\"name\":\"Sweep Ops\",\"email\":\"$KMAIL\",\"phoneNumber\":\"$KPHONE\",\"permissions\":{\"canManageWallet\":true}}" admin
KID=$(jget "d['data']['keyId']")
echo "     -> key $KID"
hit 11 "access key regenerate"       200 POST "/admin/access/$KID/regenerate" "" admin
hit 12 "access key revoke"           200 POST "/admin/access/$KID/revoke" "" admin
hit 13 "revoke is idempotent"        200 POST "/admin/access/$KID/revoke" "" admin

echo "--- WATCHLIST ---"
DEV="sweep-device-$STAMP"
hit 14 "watchlist add"               200 POST "/admin/players/watchlist" "{\"deviceId\":\"$DEV\",\"note\":\"sweep\"}" admin
hit 15 "watchlist list"              200 GET  "/admin/players/watchlist" "" admin
WATCHED=$(jget "any(w['deviceId']=='$DEV' for w in d['data']['devices'])")
[ "$WATCHED" = "True" ] && ok 15b "device in watchlist" "found" || bad 15b "device in watchlist" "not found"
hit 16 "watchlist ack"               200 PATCH "/admin/players/watchlist/$DEV/ack" "" admin
hit 17 "watchlist remove"            200 DELETE "/admin/players/watchlist/$DEV" "" admin
hit 18 "watchlist gone after remove" 200 GET "/admin/players/watchlist" "" admin
GONE=$(jget "not any(w['deviceId']=='$DEV' for w in d['data']['devices'])")
[ "$GONE" = "True" ] && ok 18b "device gone from watchlist" "gone" || bad 18b "device gone from watchlist" "still there"

echo "--- DEVICE GROUPS / BAN ---"
hit 19 "device groups list"          200 GET "/admin/players/devices" "" admin
DEV2=$(curl -s -b "$CK" -H "Origin: $ORIGIN" "$BASE/admin/players/devices" | PYTHONIOENCODING=utf-8 python -c "
import json,sys
d=json.load(sys.stdin)['data']
items=d.get('items') or d.get('groups') or []
print(items[0]['deviceId'] if items else '')
" 2>/dev/null | tr -d '\r\n')
if [ -n "$DEV2" ]; then
  echo "     -> probing device $DEV2"
  hit 20 "device detail"             200 GET   "/admin/players/devices/$DEV2" "" admin
  hit 21 "device CSV export"         200 GET   "/admin/players/devices/$DEV2/export.csv" "" admin
  hit 22 "device ban"                200 PATCH "/admin/players/devices/$DEV2/ban" '{"isBanned":true}' admin
  hit 23 "device unban (revert)"     200 PATCH "/admin/players/devices/$DEV2/ban" '{"isBanned":false}' admin
else
  echo "SKIP | 20-23 | no device groups in DB"
fi

echo "--- MEDIA ---"
hit 24 "media config"                200 GET  "/media/config" "" admin
hit 25 "media upload no file -> 400" 400 POST "/media/upload" '{}' admin
hit 26 "media upload needs auth"     401 POST "/media/upload" '{}' none

echo "--- GUARD POST-CONDITIONS ---"
hit 27 "banned-route still needs auth" 401 GET "/admin/wallet/deposits" "" none
hit 28 "player blocked from staff CRUD" 403 GET "/auth/admin/staff" "" player

echo
echo "===== PASS=$pass  FAIL=$fail ====="
echo "created: player $NEWPHONE, staff $SMAIL, key $KID, device $DEV"
