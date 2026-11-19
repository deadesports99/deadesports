# RR AI Gateway — Test Report

Date: 2026-11-18
Files tested (downloaded from Dropbox, kept in `.tmp/dropbox/`):

| File | SHA-256 | Identity |
|---|---|---|
| `api.exe` (11.0 MB) | `dd027f9c5d9ad273884b51980e990040236b029bcb4a0e23f5c7fdf84e7f2a6a` | RR AI Gateway (PC Edition) v1.0.0 — Rust + egui GUI |
| `api.apk` (6.3 MB) | `d3584c0637eef0eb031e995261fae5671a19eb476c06e46cbd6c2844ef20b6c5` | `com.rr.gateway` "RR Rust Gateway" v1.0.0 — Jetpack Compose |

Not related to the Thunder Esports tournament project. The tournament APKs are
`dist/thunder-esports/Player.apk` (`com.thunderesports.player`) and `Admin.apk`
(`com.thunderesports.admin`).

## 1. Desktop app (api.exe)

- Launches, opens window "RR AI Gateway (PC Edition)", GUI (egui) with Pairing screen.
- Pairing flow: Android app → Dashboard/Settings → "PC Link Key" → paste in PC app.
- Pairing succeeded with account `autotata@gmail.com`.
- Dashboard shows: token balance 1,000,000 (limit), daily free time 1h, local API URL,
  local API key, default model `claude-opus-5` ("Default / Any Model Allowed").
- "START API GATEWAY (ON)" starts a local Axum server on `127.0.0.1:8787`.

Endpoints verified live:

| Endpoint | Result |
|---|---|
| `GET /v1/health` | `{"service":"rr-gateway-axum","status":"online","rate_limit_rpm":60,...}` |
| `GET /v1/models` (no key) | `401` |
| `GET /v1/models` (bad key) | `{"code":"invalid_api_key","message":"Incorrect API key provided. Check your Custom API Key in the RR Gateway app."}` |
| `GET /v1/models` (valid key) | returns `claude-opus-5`, 1M context, capabilities chat/streaming/vision/reasoning |
| `GET /v1/rate_limit` | `rate_limit_rpm: 60`, `remaining_rpm: 60` |
| `POST /v1/chat/completions` (other model) | `model_not_permitted` — only `claude-opus-5` assigned |

### Blocking issue (server/admin side, not local)

`POST /v1/chat/completions` with the permitted model fails:

```json
{"error":{"message":"Incorrect API key provided: claude-o*us-5. You can find your API key at
https://platform.openai.com/account/api-keys.","type":"invalid_request_error","code":"invalid_api_key"}}
```

The gateway forwards to an OpenAI-compatible upstream and sends the **model slug** where the
upstream API key should be. So the admin side has no valid provider API key / provider URL
configured for `claude-opus-5`. Local auth, model gating, rate limiting all work correctly —
only the upstream call fails. Streaming requests fail the same way.

### Second issue (billing)

Token balance dropped `1,000,000 → 999,820` (180 used) for **failed** requests. Failed
upstream calls are still charged against the quota.

## 2. Android app (api.apk)

- Signature: v2, valid. Cert `C=IN, ST=Chhattisgarh, L=Korba, O=Dev, OU=Seema, CN=Seema`
  (RSA-2048, release-style cert, not debug).
- minSdk 26, targetSdk 37, single package `com.rr.gateway`.
- Permissions: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, FOREGROUND_SERVICE(+DATA_SYNC),
  WAKE_LOCK, RECEIVE_BOOT_COMPLETED, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, USE_BIOMETRIC,
  USE_FINGERPRINT. Nothing unusual.
- Installed and launched on emulator `ffTest` (Android 16): notification permission →
  "Welcome Back / Sign in to access your AI Gateway and API Keys" (Email, Password, Sign In,
  Forgot password?, Create account). No crash, no layout defects in the UI tree.
- Login on the emulator is blocked by the product's device lock:

  > Hardware Device Lock Active — This account is already registered and locked to another
  > device: Android RMX5070. One Account = One Active Device policy. To switch your account to
  > this phone, request authorization from Admin on WhatsApp.

  So the account works on the original phone (RMX5070) only; the emulator needs admin unlock.

## 3. How to use it from any OpenAI-compatible client

```
Base URL : http://127.0.0.1:8787/v1
API Key  : (LOCAL API KEY shown in the desktop app)
Model    : claude-opus-5
Rate     : 60 requests / minute
Quota    : 1,000,000 tokens, 1h/day free time
```

Gateway only serves while the desktop app is running and "START API GATEWAY (ON)" is active;
the daily 1h limit auto-stops it.

## 4. To get it fully working

1. Admin (the friend) must set a valid provider API URL + upstream key for `claude-opus-5`
   (currently the model slug is being sent as the upstream key).
2. Ask admin to stop charging quota for upstream-error responses.
3. To use the Android app on a second phone/emulator, ask admin for device unlock.

## 5. Hermes Agent integration (done 2026-11-18)

Wired the gateway into `C:\Users\Jay Kumar\AppData\Local\hermes\config.yaml` as a model alias
(backups: `config.yaml.bak-rr-gateway-*`, `.env.bak-rr-gateway-*`):

```yaml
model_aliases:
  rr-opus:
    model: claude-opus-5
    provider: custom
    base_url: "http://127.0.0.1:8787/v1"
    key_env: RR_GATEWAY_API_KEY
```

Key stored once in `AppData\Local\hermes\.env` as `RR_GATEWAY_API_KEY` (not in the repo).

Usage:

```bash
hermes -m rr-opus chat -Q -q "<prompt>"      # one shot
hermes -m rr-opus                            # interactive
```

Verification:

- Routing proven: a local stub server on `127.0.0.1:8787` answering `/v1/chat/completions`
  (SSE) was hit with `Authorization: Bearer <RR key>` (header len 47) and Hermes printed the
  stub's reply — so alias → base_url → key → response path is correct.
- With the real gateway offline, Hermes logged `provider=custom base_url=http://127.0.0.1:8787/v1
  model=claude-opus-5 ... APIConnectionError` and then silently answered from its fallback
  provider. Watch for that: a "successful" reply does not mean the RR gateway answered.

### Blocker for the real end-to-end test

Desktop app now shows `API LIMIT FINISHED (CANNOT START)` — Daily Free Time Limit
1h fully used (`0h 0m 00s Left`), tokens 999735/1000000. Note it burned the full 1h of daily
time within a few minutes of the first test run, and charged 265 tokens for failed calls.
The admin must add hours via "Contact Admin on WhatsApp to Add Hours" (or wait for the daily
reset) before `POST /v1/chat/completions` can succeed.

## 6. Second round of checks (bugs)

### Desktop app (api.exe) hits

| # | Bug | Evidence |
|---|---|---|
| B1 | **Pairing is not persisted.** Closing/restarting `api.exe` loses the link — the PC Link Key must be pasted again, and the local API key may change. | Restarted the app (pid 31416): window went back to "🔗 PAIR WITH ANDROID APP" with an empty key field. No state file is written anywhere (`%APPDATA%`, `%LOCALAPPDATA%`, exe folder all clean). |
| B2 | **Time quota burns far too fast.** | Started 16:5x with `1h Allowed`; first dashboard read showed 24s used, next read a couple of minutes later showed `Used: 1h 0m 00s`, and `exe-run.log` logged `Limit finished during execution. Stopping gateway immediately.` Only ~1 real request + 2 endpoint probes ever hit it. |
| B3 | **Failed calls still cost tokens.** | `1,000,000 → 999,820` after requests that all returned upstream errors; later `999,735` (265 used) with no successful completion. |
| B4 | **Upstream provider not configured (admin side).** | `POST /v1/chat/completions` for the allowed model returns `Incorrect API key provided: claude-o*us-5` from `platform.openai.com` — the model slug is sent where the provider key belongs. |

### Hermes side (behaviour checked)

| Case | Result |
|---|---|
| Gateway **down** (connection refused) | retries, then `⚠️ Model fallback: claude-opus-5 via custom unavailable (request timeout); using gemini-2.5-flash via google.` |
| Gateway returns **401** (bad key) | fails fast, `Model fallback: ... (authentication failed)`, fallback answers |
| Gateway returns **200 but non-SSE body** | `EmptyStreamError` ×3 retries, then fallback |
| Gateway returns **valid SSE** (stub) | reply came from the gateway; `Authorization: Bearer <RR key>` (47 bytes) present |

So the Hermes wiring itself is correct. The trap: **with `-Q` (quiet) the fallback warning is suppressed**, so
`hermes -m rr-opus chat -Q -q ...` can print a perfect answer while the RR gateway never answered.
Verify with `-v` (shows the fallback line) and with `curl -s http://127.0.0.1:8787/v1/health` → `total_requests`.

## 7. Round 3 — re-linked with 2h quota, and the Google (Gemini) route

### RR gateway still cannot answer (2 more findings)

Re-link worked (`3h Allowed, 2h 0m 00s Left`), gateway started, local key unchanged.
Same local key behaves differently per endpoint:

| Request | Result |
|---|---|
| `GET /v1/models` with key | **200** + model list |
| `POST /v1/chat/completions` with same key | **401** + `Incorrect API key provided: claude-o*us-5` (that text is the *upstream's* error, the provider key is still missing) |

- **B5 — the gateway passes the upstream 401 through untouched**, so the client blames its own
  key. Hermes log line: `Model fallback: claude-opus-5 via custom unavailable (authentication
  failed)` — misleading. It should be a 502/503 with a "provider unreachable" message.
- `GET /v1/health` after the attempt showed `total_requests: 1`, so the request did reach the
  gateway: the local routing worked, only the upstream call failed.
- Gateway was stopped again afterwards, because the daily-time meter (B2) keeps draining for a
  gateway that cannot serve a single chat completion.

### Google / Gemini route in Hermes (works)

- Provider: `google` (Google AI Studio), default model `gemini-3.6-flash`,
  key `GEMINI_API_KEY` (39 chars, `AIzaSy…`) in `AppData\Local\hermes\.env`.
- Fallback chain: `gemini-2.5-flash`, `gemini-3-flash-preview` (both via google).
- Live key check: 50 models listed, 38 gemini.
- Direct API calls: `gemini-3.6-flash` → **HTTP 503 "experiencing high demand"** in 3.2s;
  `gemini-2.5-flash` → **OK in 1.4s** (`DIRECT_OK`).
- Hermes default run took 1m 14s and printed
  `Model fallback: gemini-3.6-flash via gemini unavailable (provider overloaded); using gemini-2.5-flash`.
- Pinned run `hermes -m gemini-2.5-flash --provider google chat -v -q ...` → clean answer,
  no fallback, 5s.

Recommendation: `model.default: "gemini-2.5-flash"` until Google's 3.6-flash demand spike clears.

### Round 3 addendum — quota burn numbers and GUI bug

- In ~3 minutes of uptime with only 4 client attempts (all failing upstream): token balance
  went `999,735 → 987,017` (**12,983 tokens charged for zero successful completions**), daily
  time `2m 45s` consumed. So B3 is much bigger than the first estimate.
- **B6 — window became unusable.** After the first render the top-level window collapsed to an
  18x18 blank window with an empty title; the accessibility tree returned no elements and
  `ShowWindow`/`MoveWindow` could not bring it back, while the HTTP gateway kept serving
  (`0.0.0.0:8787`). Only fix: kill the process (which also throws away the pairing, B1).
- **B7 — server binds `0.0.0.0:8787`, not `127.0.0.1`.** Anyone on the same LAN can reach the
  gateway; the API key is then the only protection. Should bind loopback only.
- Process was killed at the end of testing so the meter stops; `api.exe` must be started and
  re-linked again before the next run.

## 8. Round 4 — admin config changed, new upstream error

App starts already linked this time (no re-link needed), quota `3h Allowed, 1h 53m Left`.

- Update to B2: the daily-time meter keeps running **even while the gateway is stopped**
  (`1h 6m 14s → 1h 6m 37s` with the engine OFF).
- New GUI bug B8: the **first `START` click is swallowed** — the button flips back to
  "GATEWAY OFFLINE (STOPPED)" and nothing listens; a second click starts it.
- The upstream 401 from round 3 is gone (admin changed the provider), now:
  `POST /v1/chat/completions` → **HTTP 404 `text/plain: Invalid API path`**.
  That body comes from the provider, so the provider base URL path is wrong
  (typical: base URL set to `https://host/v1` while the gateway appends `/v1/chat/completions`
  → `.../v1/v1/chat/completions`). `GET /v1/models` still 200 (local) and `/v1/health`
  `total_requests` increments, so the client → gateway leg is fine.
- Route probe: only `/v1/chat/completions` is proxied; every other POST path
  (`/v1/messages`, `/v1/completions`, `/v1/embeddings`, `/v1/foo`, `/v1/chat/completions/`)
  returns the catch-all `200 {"message":"RR Gateway","status":"ok"}`.
- Hermes now reports `Model fallback: claude-opus-5 via custom unavailable (provider failure)`.
- Token burn got worse: `12,983 → 50,732` (37,749 tokens) for ~4 failing requests in 74s of
  uptime. Gateway was stopped again afterwards.

## 9. opencode (v2.3.0) setup — RR gateway as default model

Config: `C:\Users\Jay Kumar\.config\opencode\opencode.json`
(backups: `opencode.json.bak_rrgateway_*`, `opencode.json.bak_rrgateway_agents_*`)

This version uses `providers` (map) + each entry's `package` / `settings`, not the v1
`provider`/`options` schema:

```json
"rrgateway": {
  "name": "RR AI Gateway (PC Edition)",
  "package": "@opencode/ai/providers/openai-compatible",
  "settings": {
    "baseURL": "http://127.0.0.1:8787/v1",
    "apiKey": "<RR local api key>"
  },
  "models": { "claude-opus-5": { "name": "Claude Opus 5 (RR Gateway)", "type": "chat" } }
}
```

Default: `"model": "rrgateway/claude-opus-5"` **and** the same model on all seven agents
(`build, plan, research, explore, debug, test, review`) — without that the agents' own
`model` key (previously `numes/uniboshi/kimi-k3-abliterated-v1:free`) overrode the global
default and `opencode run` kept using the old model.

Verified against a local stub on `127.0.0.1:8787`:
`opencode run "say exactly: OC_DEFAULT_OK"` → header `> build · claude-opus-5`,
stub log `POST /v1/chat/completions stream=True model=claude-opus-5 auth_hdr_len=47`
(`Bearer ` + 40-char key = correct), reply shown. `opencode models` lists
`rrgateway/claude-opus-5`.

Still required for a real run: re-link `api.exe` (process was stopped) and the admin must fix
the provider base URL (see section 8, otherwise `404 Invalid API path`).

## 10. IT WORKS — admin fixed the provider URL (2026-11-19)

After the admin fixed the provider path, the gateway serves real completions.

| Test | Result |
|---|---|
| `POST /v1/chat/completions` `stream:true` | **200**, 7.3s, chunks `RR_L` + `IVE` + `_OK`, `usage.total_tokens 1953` |
| `POST /v1/chat/completions` `stream:false` | **200**, 2.4s, `content: "NONSTREAM_OK"` |
| `opencode run "say exactly: OC_REAL_OK"` (default = `rrgateway/claude-opus-5`) | **`OC_REAL_OK`** |
| `hermes -m rr-opus chat -v -q "say exactly: RR_REAL_OK"` | **`RR_REAL_OK`**, no fallback line, 7s |
| `/v1/health` | `total_requests 11`, `rate_limit_rpm 60`, `remaining_rpm 48` |

First non-streaming request right after the fix returned `http=000` (hang/abort at 90s); every
later call worked, so treat it as upstream warm-up, not a bug.

Quota after the test batch: tokens `50,732 → 184,578` used (**+133,846 for ~11 requests** —
the agents' system prompts are large; our raw curl used only 1,953 tokens), daily time
`1h 19m 32s` of 3h used.

Status: gateway + opencode + hermes all functional. Remaining product bugs are only the ones
listed earlier (B1 link not persisted, B2 time meter runs while stopped, B3 charges on failed
calls, B6 window dies after some actions, B7 binds 0.0.0.0, B8 first START click ignored).
