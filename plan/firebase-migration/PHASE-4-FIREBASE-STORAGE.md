# Phase 4 — Firebase Storage for logos, banners and screenshots

> **Goal:** an admin can actually **upload** a tenant logo / tournament banner /
> match screenshot and get back a permanent URL, instead of pasting a URL by hand.
>
> **Guarantee:** off by default, admin-only, no new dependency, no schema change, and
> every existing "paste a URL" workflow keeps working untouched.

---

## 1. What existed before

- `Tenant.logoUrl` and `MatchResult.screenshotUrl` are plain `String?` columns.
- **There was no upload endpoint and no upload UI anywhere** (grep across backend,
  admin-web, player-web, Android). The fields are filled by hand or not at all.

So this phase only *adds* a way in. Nothing that works today changes.

---

## 2. The endpoint

```
POST /api/v1/media/upload?purpose=tenant-logo
Authorization: Bearer <ADMIN or SUB_ADMIN JWT>
Content-Type: image/png | image/jpeg | image/webp
<raw image bytes as the request body>
```

`purpose` ∈ `tenant-logo` · `tournament-banner` · `match-screenshot`

`201` response:

```jsonc
{
  "url": "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/media%2F<tenantId>%2Ftenant-logo%2F<uuid>.png?alt=media&token=<token>",
  "path": "media/<tenantId>/tenant-logo/<uuid>.png",
  "bucket": "deadesports-865d2.firebasestorage.app",
  "contentType": "image/png",
  "size": 48213,
  "purpose": "tenant-logo"
}
```

Plus `GET /api/v1/media/config` → `{ enabled, reason, maxBytes, purposes }` so the
admin UI can decide whether to show an Upload button instead of a URL field.

### Why a raw body instead of multipart

`fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: file })`
works from every client with zero parsing code, and the backend needs **no** new
dependency (no multer). The client never sends a filename, which also removes a whole
class of path-traversal and double-extension tricks.

---

## 3. Safety design

| Risk | Handling |
| --- | --- |
| Renamed executable uploaded as `logo.png` | Magic-number sniffing; the extension and content type come from the **bytes**, not the header (`detectImageType`) |
| Huge file fills the bucket | `MEDIA_MAX_UPLOAD_BYTES` (default 5 MiB) checked twice: `express.raw` limit + service check, both mapped to a readable 400 |
| Player uploads anything | Route is `requireRole('ADMIN', 'SUB_ADMIN')` |
| Cross-tenant overwrite | Path is `media/{tenantId}/{purpose}/{uuid}.{ext}` — tenant prefix comes from the JWT, the filename is a UUID |
| Guessable/enumerable objects | Random UUID filename + random download token |
| URL expiring later and breaking a live logo | Firebase **download token** stored in object metadata → permanent URL, not a signed one |
| Direct client access to the bucket | `firebase/storage.rules` denies all client read/write; the Admin SDK bypasses rules |
| Upload flood | 10 uploads/min per user |

Deliberately **not** exposed: delete, list, or "upload to an arbitrary path". The
surface is one endpoint that takes bytes and returns a URL.

---

## 4. Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDIA_UPLOAD_ENABLED` | `false` | Master switch |
| `FIREBASE_STORAGE_BUCKET` | `''` | Empty = `<FIREBASE_PROJECT_ID>.firebasestorage.app`. Older projects need `<projectId>.appspot.com` |
| `MEDIA_MAX_UPLOAD_BYTES` | `5242880` | Per-image ceiling |
| `FCM_CREDENTIALS_JSON` | — | Required; a project id alone cannot write to Storage |

---

## 5. Enabling it (runbook)

```bash
# 1. storage rules (once)
firebase deploy --only storage --project deadesports-865d2

# 2. backend env
MEDIA_UPLOAD_ENABLED=true
FCM_CREDENTIALS_JSON={...service account with Storage Object Admin...}
# FIREBASE_STORAGE_BUCKET=deadesports-865d2.appspot.com   # only if the default 404s

# 3. restart, then check
curl -H "Authorization: Bearer <admin jwt>" https://<api>/api/v1/media/config
# expect enabled: true, reason: null
```

If uploads fail with *"bucket does not exist"*, the project uses the legacy
`.appspot.com` bucket name — set `FIREBASE_STORAGE_BUCKET` explicitly.

---

## 6. Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — **398 tests, 398 pass, 0 fail** (16 new in `tests/mediaUpload.test.ts`)
- [x] Magic bytes: PNG / JPEG / WebP detected; PHP text, GIF and truncated PNG refused
- [x] Path is `media/<tenantId>/<purpose>/<uuid>.<ext>`; extension from bytes
      (JPEG bytes → `.jpg`), never from a client filename
- [x] Two tenants get different path prefixes
- [x] Returned URL is tokenised and permanent (no `Expires=` signature)
- [x] Unknown purpose → 400 · empty body → 400 · oversized → 400 · non-image → 400
- [x] Storage failure → 503 (never a fake success); missing credentials → 403
- [x] **HTTP smoke, real app + real JWT + real DB:**
      - no token → `401`
      - player JWT → `403 Access denied` (role guard works)
      - admin JWT on `/media/config` → `200`, `reason: "Media uploads are disabled on this server"`
      - `MEDIA_UPLOAD_ENABLED=true` without credentials → `reason: "...needs a Firebase service account"`
      - upload with no body → `400` with a clear message
      - a normal JSON POST to another route → `200` (no parser regression)
- [ ] **Not verified locally:** a real object landing in the bucket — needs the service
      account (see runbook §5)

---

## 7. Rollback

```
MEDIA_UPLOAD_ENABLED=false   →  restart  →  done
```

The route answers `403` with a reason; nothing else in the API is affected. Already
uploaded objects stay valid because their URLs are permanent.

---

## 8. Files touched

| File | Change |
| --- | --- |
| `backend/src/services/mediaStorage.service.ts` | **new** — sniffing, paths, permanent URL, injectable writer |
| `backend/src/controllers/media.controller.ts` | **new** |
| `backend/src/routes/media.routes.ts` | **new** — auth + role + 10/min limiter + raw parser |
| `backend/src/app.ts` | one mount line: `/api/v1/media` |
| `backend/src/config/env.ts` | 3 new optional variables |
| `backend/tests/mediaUpload.test.ts` | **new** — 16 tests, no credentials needed |
| `firebase/firebase.json` | added the `storage` block |
| `firebase/storage.rules` | **new** — deny all client access |

No client app was modified. No database schema change in this phase.

---

## 9. Incidental fix found while verifying this phase

The Phase 4 HTTP smoke test caught that **Phase 3's column must exist before the code
deploys** — Prisma selects every scalar by default, so a missing `firebaseUid` made
*all* `User` reads fail with `P2022`. The column and its unique index were applied
surgically, and `PHASE-3-AUTH-CONSOLIDATION.md` §3 now documents the real constraint
instead of the earlier (incorrect) "either order is safe" claim.

This is the concrete reason each phase is verified over real HTTP and not only with
unit tests: `FakePrisma` ignores field selection and could never have caught it.
