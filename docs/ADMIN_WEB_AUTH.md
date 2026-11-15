# 🔐 Admin web — Auth & session (as built)

> Ye doc **code se nikala gaya** hai, guess nahi: `backend/src/services/adminAuth.service.ts`,
> `backend/src/middlewares/auth.middleware.ts`, `backend/src/controllers/adminAuth.controller.ts`.
> Sochne ke liye na padho — **debug karte waqt** kaam aayega.

## 1. Do hi tarah ka admin login hai

| Kaun | Kya chahiye | Kahan code |
|---|---|---|
| **Owner** (ADMIN) | apna email → 6-digit code email pe | `POST /api/v1/auth/admin/otp/request` |
| **Staff** (SUB_ADMIN) | **owner ka email + apni 24-char key** → code **owner** ke inbox me aata hai | wahi route + `accessKey` |

> Staff ka code owner ke paas jaata hai — owner code bhejta hai (WhatsApp/call). Isi wajah se
> staff ko koi password ya email infra nahi chahiye.

## 2. OTP ke rules (exact numbers)

| Rule | Value | Kahan |
|---|---|---|
| OTP valid | **10 minute** (`OTP_TTL_MS`) | adminAuth.service.ts:34 |
| Galat try limit | **5** (`OTP_MAX_ATTEMPTS`) → uske baad code dead | :35 |
| Naya code maangne ki limit | **3 / 10 min** per IP (`adminOtpRequestLimiter`) | adminAuth.routes.ts:15 |
| Verify ki limit | **5 / 15 min** (`adminLoginLimiter`) | :16 |
| Daily cap (per identity) | **10 codes / rolling 24h** (`ADMIN_OTP_DAILY_CAP`) — audit log se ginti | env + service |
| Session | **12 ghante** (`ADMIN_SESSION_TTL_HOURS`), httpOnly cookie | controller |

Cap cross hone par: `429 — Daily sign-in code limit reached.`

## 3. Access key (staff key) ke rules

- **24 characters**, DB me sirf **hash** (pepper = `ACCESS_KEY_PEPPER`), UI me sirf `keyHint` (last 4) dikhta hai.
- **Revoke** turant: `POST /api/v1/admin/access/:id/revoke` → `revokedAt` set.
- **Regenerate**: purani key dead, nayi 24-char key **ek hi baar** dikhti hai.
- **Expiry** optional (`expiresAt`), **ban** bhi (`isBanned`).
- Staff session key se **bandha** hota hai: cookie me `accessKeyId` hai → har request pe
  `assertAccessKeyUsable()` chalta hai. **Key revoke = session agle request pe hi dead.**
  (Yahi reason hai ki revoke ke baad logout ka wait nahi karna padta.)

## 4. Session cookie

```
admin_session=<JWT>; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200
                   (+ Secure jab NODE_ENV=production)
```

- JS se **read nahi hota** (httpOnly) → XSS se token chori nahi hota.
- `SameSite=Strict` + CSRF gate (neeche) = double protection.
- JWT me: `userId`, `tenantId`, `role`, (staff ke liye) `accessKeyId`.
- Har request pe auth middleware: user exist? · `tenantId` match? · **banned?** ·
  tenant **active?** → warna `401/403`.

## 5. CSRF gate (cookie requests)

`assertCookieRequestOrigin(req)` — sirf jab request **cookie** se aayi ho:
`Origin`/`Referer` **`ADMIN_WEB_ORIGIN`** se match karna chahiye, warna:

```json
{"success":false,"message":"Blocked cross-site request","statusCode":403}
```

> **Deploy me sabse common galti:** `ADMIN_WEB_ORIGIN` galat/trailing slash.
> `https://spartan-arena.onrender.com` ✅ · `https://spartan-arena.onrender.com/` ❌

Login (`otp/request`, `otp/verify`) pe ye gate **nahi** lagta — us waqt cookie hoti hi nahi.

## 6. Email enumeration safe hai

Unknown email aur known email — **same jawab**:

```
"If this email has access, a sign-in code has been sent."
```

Owner/staff/USER role sabpe same message, same 200. Isliye koi pata nahi kar sakta kaun
registered hai.

## 7. 30-second auth cache (kyun logout turant na lage)

`auth.middleware.ts` me per-user cache (30s TTL) hai — har request pe DB na jaaye.
Iska matlab: **ban/role change 30 second tak purana dikh sakta hai**. Money routes pe
cache permission ko affect nahi karta (permission request pe hi check hota hai), par
ban/tenant-deactivate 30s tak late ho sakta hai. Ye jaan-boojh kar hai (speed vs instant).

## 8. Audit trail

Har admin action `AdminAuditLog` me jaata hai (`action`, `actorId`, `targetId`, `metadata`, IP).
OTP request bhi log hota hai (`ADMIN_OTP_REQUESTED`) — daily cap isi se count hota hai.

## 9. Security layers (7) — koi domain nahi chahiye

1. OTP hash (plain code DB me nahi) + 10-min TTL
2. 24-char key, sirf hash + last-4 hint
3. Rate limits (3/10min request, 5/15min verify, 10/day cap)
4. httpOnly + SameSite=Strict + Secure cookie
5. CSRF Origin gate
6. Banned / revoked / expired / tenant-inactive checks **har request pe**
7. Audit log (kaun, kab, kya, kis IP se)

> URL chhupana security nahi hai — in 7 layers ki wajah se hi `*.onrender.com` URL safe hai.

## 10. Debug — symptom → jahan dekho

| Symptom | Pehle ye check karo |
|---|---|
| Mail hi nahi aaya | backend log me `📧 [EMAIL:brevo] sent to=…` line hai? |
| `401 Invalid or expired token` | cookie ka `Max-Age` cross? `JWT_SECRET` deploy pe badla? |
| `403 Blocked cross-site request` | `ADMIN_WEB_ORIGIN` vs browser URL (trailing slash!) |
| `403 You lack permission…` | staff key me wo flag off hai → Staff screen se on karo |
| Staff logged out randomly | key revoke/expire hui, ya owner ne regenerate kiya |
| `429 Daily sign-in code limit` | 10/day cap — agla din, ya cap badhao |
| Login ke baad 30s purana data | auth cache (section 7) — normal |
