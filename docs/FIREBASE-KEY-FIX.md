# Firebase delivery layer — blocked: service account key invalid

**Status (2026-11-16):** ❌ BROKEN. Delivery layer ON hai par har write silently drop ho rahi hai.
Ye file sirf diagnosis + fix ke liye hai. Koi config abhi badla **nahi** gaya.

## Symptom

Backend log / `npm run verify:firebase`:

```
16 UNAUTHENTICATED: Request had invalid authentication credentials.
  Expected OAuth 2 access token, login cookie or other valid authentication credential.

invalid_grant: Invalid JWT: Token must be a short-lived token (60 minutes)
  and in a reasonable timeframe. Check your iat and exp values in the JWT claim.
```

`[liveMirror] Firestore batch write failed`
`[liveFeed] read failed`
`[stats] batch write failed`

`google-auth-library` warning bhi aata hai:
`The credentials option is deprecated. Please use the auth object constructor instead.`

## Verify output (7 checks)

| Check | Result | Note |
|---|---|---|
| Setup — service account loaded | ✅ PASS | project `deadesports-865d2`, `f***@...iam.gserviceaccount.com` |
| Setup — Firestore round-trip | ❌ FAIL | `16 UNAUTHENTICATED` |
| Phase 1 — live mirror write | ❌ FAIL | `queued=1 dropped=1 written=0` |
| Phase 2 — live feed read | ❌ FAIL | `source="error"` instead of `"firestore"` |
| Phase 4 — Storage upload | ❌ FAIL | `invalid_grant: Invalid JWT` |
| Phase 5 — stats snapshot | ⏭ SKIP | no active tenant to snapshot |
| All — security rules | ⏭ SKIP | Admin SDK bypasses rules — manual deploy needed |

## Why it looked like it worked

`stats` collection me `53a09545-..._2026-11-14` document pada hai (`createTime`
2026-11-14T12:42:44Z). Wo tab likha gaya jab key valid thi. Usne galat signal diya ki
"Firebase chal raha hai". **Aaj ki koi write nahi ja rahi.**

Firestore me filhaal sirf 2 collections hain: `stats`, `live_events` (khaali).

## Fix (jab karna ho)

1. Firebase Console → Project Settings → **Service accounts** → *Generate new private key*
   → JSON download.
2. Us JSON ko **ek line** me convert karo (multi-line `.env` me tootta hai):
   ```bash
   node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('key.json','utf8')|0?JSON.parse(require('fs').readFileSync('key.json','utf8')):null))"
   ```
   ya simpler:
   ```bash
   node -e "const k=require('./key.json');console.log(JSON.stringify(k))"
   ```
3. `backend/.env` me `FCM_CREDENTIALS_JSON=` ke aage wo single line paste karo.
   (`fcm-one-line.txt` file repo me padi hai — isi kaam ke liye.)
4. Backend restart.
5. Verify:
   ```bash
   cd backend && npm run verify:firebase
   ```
   Target: **7/7 pass**. `dropped=0`, `source="firestore"`.

## Fix ke baad bhi pending

- **Composite index:** live feed query `audience + userId + createdAt` par chalti hai
  (`backend/src/services/liveFeed.service.ts:139-155`). `firebase/firestore.indexes.json`
  me index hai — deploy hona chahiye. Bina index ke Phase 2 `source="error"` deta hai.
  ```bash
  firebase deploy --only firestore:indexes,firestore:rules,storage --project deadesports-865d2
  ```
- **Rules:** service account se verify nahi hote. Deploy ke baad console me confirm karo
  ki public read bacha nahi hai.

## Jab tak fix na ho — options

| Chahte ho | Kya karo |
|---|---|
| Log spam band, app normal | `DEV_FAKE_FIREBASE=true`, `LIVE_FEED_ENABLED=false`, `FIREBASE_LIVE_MIRROR=false` |
| Sirf locally test | wahi — core tournament/wallet/admin in flags par depend nahi karte |
| Production deploy | key fix **zaroori** hai, iske bina mat jao |

## Ye dokument kyun

Firebase delivery layer **optional** hai (LOCAL_DEV.md: app ka Supabase/Firebase par
runtime dependency nahi). Par jab tak ye broken hai, push notification, live score feed
aur admin stats **kaam nahi karenge** — aur error silent hai (`dropped=1`), isliye
bina verify chalaye pata nahi chalta.
