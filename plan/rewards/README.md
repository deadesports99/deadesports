# Rewards plan — Referral · Earn · Daily Bonus · Tasks

> **Hinglish TL;DR (owner ke liye)**
> Chaar naye module: **Referral**, **Earn (hub)**, **Daily Bonus**, **Tasks**.
> Sab ek hi `client_config.json` se **build ke time** on/off ho sakte hain
> (`"features": { "referral": true, "daily_bonus": false ... }`) — JSON me
> `false` karke rebuild = us APK me module hi nahi. Upar se server se bhi
> band kar sakte hain (rebuild ke bina) — dono ON hon tabhi UI dikhta hai.
> UI: bottom bar me 5th tab **Rewards** (recommended) jisme daily bonus hero,
> tasks list aur referral card ek hi page pe — theme wahi demo wala
> (navy + gold, claim = gold, paid = green, info = cyan).
> Pehle plan padh lo, phir `01 → 02 → 03 → 04` order me code karte hain.

---

## Why these four are one feature

They share one thing: **money credited without a match**. One ledger path, one
anti-abuse path, one admin config, one screen. Building them together avoids four
half-features and four ways to double-pay a player.

| Module | Player gets | Trigger | Risk if careless |
| --- | --- | --- | --- |
| Daily bonus | ₹2–₹20 (configurable ladder) | 1 claim per IST day, streak grows | Double claim on clock change |
| Tasks | ₹5–₹50 per task | Progress from real events (join / play / top-10 / first deposit) | Fake progress, farmable |
| Referral | ₹20–₹50 (referrer) + ₹10–₹20 (friend) | Friend joins + plays 1 paid match | Self-referral farms, bot accounts |
| Earn hub | All of the above in one page | — | Just UI, no money |

Everything is **play money**: bonuses land in `DEPOSIT` balance, so they can be
used for entry fees but are **not withdrawable** (only winnings are). That is the
line that keeps this from becoming a free-money machine.

---

## Documents

| File | What it settles |
| --- | --- |
| [`01-feature-flags.md`](01-feature-flags.md) | Build-time one-click on/off + runtime kill switch, exact files & Gradle wiring |
| [`02-backend.md`](02-backend.md) | Prisma models, enums, endpoints, ledger, anti-abuse, admin config |
| [`03-android-ui.md`](03-android-ui.md) | Screens, entry points, navigation, states, copy, component reuse |
| [`04-rollout-testing.md`](04-rollout-testing.md) | Milestones, effort, test matrix, risks, what to verify on device |

---

## Placement decision — ✅ DECIDED: 5th bottom tab "Rewards"

Owner picked **Option A** (see below). The tab is inserted before Wallet and only
exists when `features.earn_hub` is on and at least one money module is enabled.
Recording the alternatives here so the reasoning survives.

Three ways to reach the new modules. All three are flag-gated, so we can ship A
now and B later without touching the modules themselves.

**Option A — 5th bottom tab "Rewards"** *(recommended)*
`Tournaments · My Matches · Rewards · Wallet · Settings`
- One obvious home, badge dot when a claim is pending, one back-stack route.
- Costs ~12dp of tab width per item on a 360dp screen — labels get tight but
  `DemoBottomBar` already truncates labels; 5 items at 68dp still clears 48dp
  touch targets.
- Risk: bottom bar starts to feel crowded; existing users relearn the bar.

**Option B — no new tab, entry points only**
Coin button in the Tournaments header (badge) + "Earn more" card on Wallet +
rows in Settings.
- Zero changes to the bottom bar, zero relearning.
- Risk: daily bonus gets forgotten — exactly the metric this feature exists for.

**Option C — 5th tab only when the hub has ≥2 modules enabled**
Best of both, one extra conditional in `PlayerTab`.
- Risk: bar shape changes between client builds; support has to remember which
  build shows what.

Chosen: **A** — all three modules are in scope, so the hub is never empty; the tab
is inserted only when `features.earn_hub` is on.

---

## Gate model in one picture

```
client_config.json  ──build time──►  BuildConfig.FEATURE_*  ─┐
 (per client APK)                                            ├─ AND ─► UI visible
 tenant settings     ──runtime────►  FeatureFlags (app)    ──┘         + API allowed
```

- Both gates ON → module renders and its API calls are made.
- Build gate OFF → no tab, no screen, no API call (R8 can strip the screen).
- Server gate OFF → same, but **without rebuilding** (support / kill switch).
- API always re-checks the server gate, so a stale APK cannot claim.

---

## Open questions (ask before M1)

1. ~~Placement: A, B or C~~ → **A (5th tab)** decided.
2. Bonus money: `DEPOSIT` balance only (recommended) vs also withdrawable.
3. Numbers: daily ladder, referral amount, task rewards — defaults proposed in
   `02-backend.md` §4, editable from admin later.
4. Referral qualification: friend must **join 1 paid match** (proposed) vs only
   install vs first deposit.
