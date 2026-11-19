# 04 — Rollout, test matrix, risks

---

## 1. Milestones (order matters — each one is shippable)

| # | Milestone | Output | Depends on | Est. |
| --- | --- | --- | --- | --- |
| **M0** | Feature-flag plumbing | `features` block, Gradle `BuildConfig`, `FeatureFlags.kt`, `tools/features.ps1`, server `features` in tenant settings | — | 0.5 day |
| **M1** | Backend money core | Prisma models + migration, `rewardConfig`, daily bonus service + 2 endpoints + tests | M0 (server flags) | 1.5 day |
| **M2** | Tasks | `TaskDefinition` seed, progress derivation, claim endpoint + tests | M1 | 1 day |
| **M3** | Referral | profile/code, apply, qualification hook in `settlement.service`, payout + tests | M1 | 1.5 day |
| **M4** | Android hub | `RewardsHubScreen` + `DailyBonusSheet` + wallet/header entries + tab, flags wired | M1–M3 API | 2 day |
| **M5** | Polish + admin | `ReferralScreen`, admin rewards page (ladder / tasks / claims log), optional FCM reminder | M4 | 1.5 day |
| **M6** | QA + rollout | Flag matrix on emulator + phone, prod migration, kill-switch drill | all | 1 day |

Total ≈ **9 working days**. M0 alone is worth landing first: it is the "one click
on/off" the owner asked for, and it touches nothing that can break a match.

---

## 2. Build matrix (must all pass)

| Build | Flags | Expected |
| --- | --- | --- |
| A | all ON | 5 tabs, hub full, claims work |
| B | `referral=false` | 5 tabs, no referral card/screen, referral API never called |
| C | `daily_bonus=false tasks=false referral=false` | 4 tabs, no hub, no coin pill, no wallet earn card, no sheet |
| D | `tasks=false` only, server `daily_bonus=false` | Tasks visible, daily block hidden after first foreground |
| E | all ON in APK, server `earn_hub=false` | Tab disappears on next foreground without rebuild |
| F | old APK against new backend | Old app ignores `/rewards`, nothing breaks |

Commands:

```bash
cd android && ./gradlew :app-player:assembleDebug -Pfeature.daily_bonus=false
adb -s emulator-5554 install -r app-player/build/outputs/apk/debug/app-player-debug.apk
adb -s emulator-5554 logcat -d | grep FeatureFlags      # proof of baked values
```

---

## 3. Test plan

### Backend (Jest, existing style)
- daily bonus: fresh claim, same-day second claim → 409, streak 1→2→…→7→wrap,
  missed day → reset, IST boundary.
- tasks: progress derived from slot/result rows, claim incomplete → 409, claim
  twice → 409, repeatable period rollover.
- referral: code unique, self-apply → 400, qualification on `End Match`, payout
  once (`@@unique([referrerId, refereeId])`), `maxPerDay` cap.
- ledger: exactly one `WalletLedger` row per credit, correct `category`,
  `referenceId`, `balanceAfter`.
- flags: module off → endpoint 404.

### Android (emulator-5554, real backend)
1. Fresh install, all flags on → Rewards tab visible, hub loads.
2. Claim daily bonus → CTA flips to `Claimed ✓`, wallet ₹ increases, passbook row
   `DAILY_BONUS` appears on Wallet tab.
3. Kill app, reopen same day → hero says `Kal aana` (no double claim possible).
4. Complete a task (join a match) → row claimable, claim credits ₹5.
5. Referral: copy code, apply from second account → invitee appears `PENDING`,
   then `QUALIFIED` after their paid match, then `PAID` + ₹40 credited.
6. Flag-off build (C) → tab gone, `grep -c rewards` in logcat = 0 API calls.
7. Server kill switch (E) → force-stop + relaunch → tab gone.
8. Light theme + dark theme screenshots of the hub.
9. TalkBack pass on hero + one task row.
10. Real phone (6103d5c2): install, force-stop, relaunch (the stale-process gotcha
    we already hit with RoomScreen).

---

## 4. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Double credit on retry/double tap | Real money loss | Unique keys + conditional flips + ledger `referenceId` (same pattern as deposits) |
| Clock spoofing for daily bonus | Free daily money | Server-side IST day key only |
| Referral farms | Money drain | Qualification on paid match, device/phone heuristics, `maxPerDay`, admin VOID |
| Feature-flag drift (client vs server) | Support confusion | Debug log line + `GET /rewards/summary` returns the effective flags; admin sees them too |
| Prod migration on live DB | Downtime | Additive-only migration (new tables + enum values + nullable columns); run `prisma migrate deploy` in the quiet window |
| Play Store policy (rewards + real money) | Rejection | Bonuses are **non-withdrawable** play money; no "cash reward for referral" wording; no dice/lottery framing |
| Owner changes numbers unexpectedly | Ledger surprises | All amounts in `Tenant.rewardConfig`, validated by zod, audit-logged on PATCH |

---

## 5. Rollback

1. **Soft:** `PATCH /admin/tenant/settings { features: { referral: false ... } }`
   → modules vanish on next foreground. No deploy.
2. **Hard:** revert the APK build flag and ship; backend tables can stay (they are
   inert without the feature flags).
3. **Money:** every credit is one ledger row per claim id; a bad batch is
   reversible with a `DEBIT` row per `referenceId` (admin script, audit-logged).

---

## 6. What I would verify on the owner's phone before calling it done

- [ ] Rewards tab position feels right next to Wallet (thumb reach, no crowding).
- [ ] Daily bonus sheet does not fire on top of a push-deep-linked Room screen.
- [ ] Claim animation/haptic is subtle (no confetti spam) — theme is "arena", not
      casino.
- [ ] Hinglish copy reads naturally, not translated-English.
- [ ] ₹ rounding: `2` not `₹2.00`, `₹1,250` grouping (existing `formatMoney`).