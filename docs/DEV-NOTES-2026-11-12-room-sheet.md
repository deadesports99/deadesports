# Room-ID work + local server notes (12 Nov 2026)

Temporary handover note while the Supabase → Firebase DB move is in progress.
Delete this file once the migration is done and everything is re-verified.

## Local setup that was working

| Piece | How it was started |
| --- | --- |
| Backend (Express + Prisma) | `cd backend && node ./node_modules/tsx/dist/cli.mjs ./src/server.ts` → `http://localhost:5000` |
| Player web (Vite) | `cd player-web && node ./node_modules/vite/bin/vite.js --port 5173` → `http://localhost:5173` |
| Phone (adb, real device `RMX5070`) | `adb reverse tcp:5000 tcp:5000` (also in `connect_phone.bat`) |

## Player-app change: room code is now a bottom sheet

Files:

- `android/app-player/src/main/java/com/tourney/player/ui/matches/RoomDetailsSheet.kt` **(new)**
  - Old "Custom Room" look, now a `ModalBottomSheet`: header (no key icon), "Match Lobby Open ✅",
    Room ID + Room Password tiles with Copy, "📋 Copy Room ID & Password" bar.
  - Polls `GET /tournaments/:id/room` every 20s while open → an edited room shows up without
    closing the sheet (the old screen only polled while *locked*, which left stale codes).
  - Compact layout pass: 14dp sheet padding, one-line credential boxes (15sp mono value),
    40dp-ish copy bar, no footnote line.
- `ui/matches/MatchCard.kt` — CTA states: `Room ID Ready` (joined + room published, green + gold
  ring), `Joined ✓` (joined, room not published), `Join • ₹X` (not joined), `Watch live`, `Slot Full`.
- `ui/matches/MatchesScreen.kt` — `roomReady = joined && tournament.isRoomReadyToView()`; a seated
  player opens the sheet, a non-seated player only ever gets the join sheet.
- `RoomCredentialsDialog.kt` — deleted (unused dead code, replaced by the sheet).

No backend / Prisma / schema changes were made for this feature — it uses the existing
`GET /api/v1/tournaments/:id/room` endpoint, so the Firebase migration does not affect it.

## Verified on the device — BEFORE the DB reset

- Not joined → card shows only `Join • ₹10`.
- Joined, room not published → `Joined ✓`.
- Admin published the room → card flipped to `Room ID Ready` **without a manual refresh** (WS).
- Sheet opened with the real code, Copy and Copy-both both landed on the clipboard.
- Admin edited the password while the sheet was open → the sheet picked it up in ~20s.
- No crashes / no HTTP 500s.

## Re-verified AFTER the DB migration (local Postgres + pinned tenant)

1. Player APK rebuilt and installed (`android/gradlew :app-player:assembleDebug`).
   The bundled `assets/client_config.json` was checked inside the APK: tenant
   `53a09545-…` ✔
2. Login as `9999900003` (₹750) worked; feed showed the 2 seeded OPEN matches
   (both with the plain `Join • ₹X` CTA — no room button for non-seated players).
3. Joined "Daily Bermuda Squad Bash #101" → wallet ₹750 → ₹700, `1/48 Slots`, CTA `Joined ✓`.
4. Admin published the room → CTA flipped to `Room ID Ready` on its own (realtime).
5. Tapped the card → compact bottom sheet (bottom ~1/3 of the screen, no key icon):
   Room ID `55912034`, Password, per-row Copy (clipboard confirmed), Copy-both bar.
6. Admin changed the password while the sheet stayed open → sheet showed the new value in ~20s.
   No crashes, no 500s.

Current demo state in the local DB: match #101 (Bermuda Squad) has 1 seated player
(`9999900003`) and the room published as `55912034` / `arena777`.

## Match number was blank on both apps (fixed)

Symptom: player card + admin "Publish Room ID" list showed **no match number** (`—`).

Cause: the API assigns `matchNumber` (`nextMatchNumber()` = max+1) on create, but the demo
matches in `backend/prisma/seed.ts` were inserted **without** it, so `matchNumber` was `NULL`
and the clients render nothing (player chip / admin `"—"`).

Fix:

1. `npx tsx scripts/backfill_match_numbers.ts --apply` → existing rows got #1, #2
   (idempotent, only NULL rows; it also normalises the title to `"<n> | <Map> <Type>"`).
2. `prisma/seed.ts` now writes `matchNumber: 1` / `2` for the demo matches, so a fresh seed
   never produces blanks again.
3. Verified: player feed shows the `1` / `2` chip, admin list shows `1 — Bermuda • Squad`,
   `2 — Purgatory • Solo`, and a newly created match got **#3** automatically.

Note: the card title is generated client-side (`displayName` = `"<n> | <Map> • <Type>"`), the
DB `title` column is only used by admin lists — so both stay in sync once `matchNumber` is set.

## Match card: live kickoff countdown (final layout)

`ui/matches/MatchCard.kt` — final layout:

```
[7] [Bermuda] [SQUAD]            MATCH STARTS IN
                                    01:57:48
12 Nov, 08:00 PM              <- kickoff date/time, directly under the chips
PRIZE POOL / PER KILL / ENTRY FEE strip ...
0/48 Slots   48 left            [ Join • ₹70 ]
```

History of this card (all three steps are now in one place):

1. Map/mode chips at the top were replaced by a live countdown (kept).
2. The match number chip stayed, the duplicate title line `"7 | Bermuda • Squad"` was dropped —
   the chips already carry number + map + mode, so the title only repeated them.
3. The exact kickoff date/time lives on its own line directly under the chips row (7dp gap);
   the countdown keeps the right side of that area.

- `MatchCountdown()` uses `LaunchedEffect { while(true) { …; delay(1_000) } }` and reads time from
  `TimeAuthority.currentTimeMillis()` (server-synced by `ServerTimeInterceptor`), so a phone with a
  wrong clock still counts down correctly.
- Formats: `> 1 day` → `2d 04h 10m`, `> 1 hour` → `02:15:22`, `< 1 hour` → `05:42`.
- Colours: gold (calm) → rose/red + pulsing 5dp dot inside the last 15 min → `STARTING NOW` at
  kickoff → `LIVE NOW` (red) when the match status is LIVE.
- Verified on device: gold `02:02:07`, red `05:42` with pulse, live card `LIVE NOW`, ticks every
  second, chips row → `12 Nov, 08:00 PM` → prize strip, no duplicate title, balanced spacing, no
crashes. Test match #4 was cancelled.

## Tenant id — read before seeding again

The local Postgres (`postgresql://localhost:5433/freefire_tournament`, see `backend/.env`)
currently has exactly one tenant:

```
53a09545-e6e2-4cf5-a5c2-7ef18b276a52   apex-ff   "Apex Free Fire Club"
```

The previous DB (Supabase) used `a3c11cd0-324e-4886-b27c-9667fd7f59dc`. Clients ship the tenant
id, so old builds now fail with **"Tenant not found"**. Already updated to the new id:

- `android/app-player/src/main/assets/client_config.json`
- `android/app-admin/src/main/assets/client_config.json`
- `player-web/.env`, `player-web/.env.example`, `player-web/src/lib/api.ts`
- `backend/prisma/seed.ts` — the tenant id is now **pinned** (`TENANT_ID`) instead of being random
  on every fresh seed. If the tenant id changes again, update the list above + this note.

Seed users in the current DB: `9999900001` (ADMIN), `9999900002` (SUB_ADMIN),
`9999900003`, `9999900004` (USER). Dev login works with `dev_otp_<phone>` while
`DEV_FAKE_FIREBASE=true`.

## Same card layout on player-web

`player-web/src/components/tournaments/MatchCard.tsx` now matches the app:

```
[7] [Bermuda] [SQUAD]            MATCH STARTS IN
                                    01:44:40
12 Nov, 08:00 PM
PRIZE POOL / PER KILL / ENTRY FEE strip ...
```

- New `MatchCountdown` component (per-card `setInterval(1000)`, cleaned up on unmount):
  `> 1 day` → `2d 04h 10m`, `> 1 hour` → `02:15:22`, `< 1 hour` → `05:42`; rose/red + pulsing dot
  in the last 15 minutes, `STARTING NOW` at kickoff, `LIVE NOW` for status LIVE.
- `TournamentMatch` gained `matchNumber`, `kickoffIso`, `isLive`, `modeChip` (all optional);
  `toMatch()` fills them from `ApiTournament`, and `formatKickoffStamp()` renders `12 Nov, 08:00 PM`
  (IST, uppercase AM/PM to match the app).
- The duplicate title line (`match.title`) was dropped from the card — the chips already show
  number + map + mode. `MatchSheet` still uses `match.title` / `match.time`, untouched.
- Vertical nudge: the app card's top padding went `14dp → 10dp` and the date gap `7dp → 5dp`, so
  the chips + date sit a touch higher (same instruction applied to the web card via `mt-1.5`).

Verified: `npx tsc --noEmit` clean, page reload shows number chip → chips → countdown → date →
prize strip for all three matches, countdown ticking.

## Left to do

- Optional: web home still shows a hardcoded "1 Live • 3 Upcoming"
  (`player-web/src/screens/TournamentsScreen.tsx:60`) instead of real counts.
- Optional: same live countdown on the `player-web` match card.

DONE — DB migration re-verified (see "Re-verified AFTER the DB migration" above).
